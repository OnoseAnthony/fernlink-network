use jni::objects::{JByteArray, JClass, JString};
use jni::sys::{jboolean, jbyte, jint, jlong, jshort, jstring, JNI_FALSE, JNI_TRUE};
use jni::JNIEnv;

use fernlink_core::{
    consensus::{evaluate, ConsensusResult},
    crypto::{verify_proof, Keypair},
    message::{Commitment, TxStatus, VerificationProof},
};

// ── helpers ───────────────────────────────────────────────────────────────────

fn jni_throw(env: &mut JNIEnv, msg: &str) {
    let _ = env.throw_new("java/lang/RuntimeException", msg);
}

// ── Keypair ───────────────────────────────────────────────────────────────────

/// Generate a new Ed25519 keypair.
/// Returns 64 bytes: [secret_seed (32) || public_key (32)].
#[no_mangle]
pub extern "system" fn Java_xyz_fernlink_sdk_FernlinkJni_generateKeypair<'local>(
    mut env: JNIEnv<'local>,
    _class: JClass<'local>,
) -> JByteArray<'local> {
    let kp = Keypair::generate();
    let seed = kp.signing_key.to_bytes();
    let pubkey = kp.public_key_bytes();
    let mut out = [0u8; 64];
    out[..32].copy_from_slice(&seed);
    out[32..].copy_from_slice(&pubkey);

    // jni expects &[i8], cast via unsafe
    let out_i8: &[i8] = unsafe { std::slice::from_raw_parts(out.as_ptr() as *const i8, out.len()) };
    match env.new_byte_array(64) {
        Ok(arr) => {
            let _ = env.set_byte_array_region(&arr, 0, out_i8);
            arr
        }
        Err(_) => JByteArray::default(),
    }
}

/// Derive the Ed25519 keypair from a 32-byte seed.
/// Returns 64 bytes: [secret_seed (32) || public_key (32)].
/// Unlike generateKeypair(), the public key is deterministically derived from the seed.
#[no_mangle]
pub extern "system" fn Java_xyz_fernlink_sdk_FernlinkJni_keypairFromSeed<'local>(
    mut env: JNIEnv<'local>,
    _class: JClass<'local>,
    seed_bytes: JByteArray<'local>,
) -> JByteArray<'local> {
    let result = (|| -> Result<[u8; 64], Box<dyn std::error::Error>> {
        let seed_vec = env.convert_byte_array(&seed_bytes)?;
        let seed: [u8; 32] = seed_vec.try_into().map_err(|_| "seed must be 32 bytes")?;
        let kp = Keypair::from_bytes(&seed);
        let pubkey = kp.public_key_bytes();
        let mut out = [0u8; 64];
        out[..32].copy_from_slice(&seed);
        out[32..].copy_from_slice(&pubkey);
        Ok(out)
    })();

    match result {
        Ok(bytes) => {
            let bytes_i8: &[i8] = unsafe { std::slice::from_raw_parts(bytes.as_ptr() as *const i8, bytes.len()) };
            match env.new_byte_array(64) {
                Ok(arr) => { let _ = env.set_byte_array_region(&arr, 0, bytes_i8); arr }
                Err(_)  => JByteArray::default(),
            }
        }
        Err(e) => { jni_throw(&mut env, &e.to_string()); JByteArray::default() }
    }
}

// ── Proof signing ─────────────────────────────────────────────────────────────

/// Sign a verification proof.
/// keypairSeed: 32-byte array, txSignature: base58 string,
/// statusByte: 0=confirmed/1=failed/2=unknown, slot/blockTime: longs, errorCode: short.
/// Returns JSON string of the signed VerificationProof, or null on error.
#[no_mangle]
pub extern "system" fn Java_xyz_fernlink_sdk_FernlinkJni_signProof<'local>(
    mut env: JNIEnv<'local>,
    _class: JClass<'local>,
    keypair_seed: JByteArray<'local>,
    tx_signature: JString<'local>,
    status_byte: jbyte,
    slot: jlong,
    block_time: jlong,
    error_code: jshort,
) -> jstring {
    let result = (|| -> Result<String, Box<dyn std::error::Error>> {
        let seed_vec = env.convert_byte_array(&keypair_seed)?;
        let seed: [u8; 32] = seed_vec.try_into().map_err(|_| "seed must be 32 bytes")?;
        let kp = Keypair::from_bytes(&seed);

        let tx_sig: String = env.get_string(&tx_signature)?.into();
        let mut tx_sig_bytes = [0u8; 64];
        let raw = tx_sig.as_bytes();
        let len = raw.len().min(64);
        tx_sig_bytes[..len].copy_from_slice(&raw[..len]);

        let status = match status_byte {
            0 => TxStatus::Confirmed,
            1 => TxStatus::Failed,
            _ => TxStatus::Unknown,
        };

        let proof = kp.sign_proof(tx_sig_bytes, status, slot as u64, block_time as u64, error_code as u16);
        Ok(serde_json::to_string(&proof)?)
    })();

    match result {
        Ok(json) => match env.new_string(json) {
            Ok(s) => s.into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(e) => {
            jni_throw(&mut env, &e.to_string());
            std::ptr::null_mut()
        }
    }
}

// ── Proof verification ────────────────────────────────────────────────────────

/// Verify the Ed25519 signature on a VerificationProof JSON string.
#[no_mangle]
pub extern "system" fn Java_xyz_fernlink_sdk_FernlinkJni_verifyProof<'local>(
    mut env: JNIEnv<'local>,
    _class: JClass<'local>,
    proof_json: JString<'local>,
) -> jboolean {
    let result = (|| -> Result<bool, Box<dyn std::error::Error>> {
        let json: String = env.get_string(&proof_json)?.into();
        let proof: VerificationProof = serde_json::from_str(&json)?;
        Ok(verify_proof(&proof).is_ok())
    })();

    match result {
        Ok(true) => JNI_TRUE,
        _ => JNI_FALSE,
    }
}

// ── Consensus ─────────────────────────────────────────────────────────────────

/// Evaluate a JSON array of VerificationProofs.
/// Returns: { "settled": bool, "status"?: string, "slot"?: number, "proofCount": number }
#[no_mangle]
pub extern "system" fn Java_xyz_fernlink_sdk_FernlinkJni_evaluateProofs<'local>(
    mut env: JNIEnv<'local>,
    _class: JClass<'local>,
    proofs_json: JString<'local>,
    _min_proofs: jint,
) -> jstring {
    let result = (|| -> Result<String, Box<dyn std::error::Error>> {
        let json: String = env.get_string(&proofs_json)?.into();
        let proofs: Vec<VerificationProof> = serde_json::from_str(&json)?;
        let consensus = evaluate(&proofs, Commitment::Confirmed);

        let out = match consensus {
            ConsensusResult::Settled { status, slot, block_time } => {
                let status_str = match status {
                    TxStatus::Confirmed => "confirmed",
                    TxStatus::Failed    => "failed",
                    TxStatus::Unknown   => "unknown",
                };
                serde_json::json!({ "settled": true, "status": status_str, "slot": slot, "blockTime": block_time, "proofCount": proofs.len() })
            }
            ConsensusResult::Finalized { slot, block_time } => {
                serde_json::json!({ "settled": true, "status": "finalized", "slot": slot, "blockTime": block_time, "proofCount": proofs.len() })
            }
            ConsensusResult::Pending => {
                serde_json::json!({ "settled": false, "proofCount": proofs.len() })
            }
        };
        Ok(out.to_string())
    })();

    match result {
        Ok(json) => match env.new_string(json) {
            Ok(s) => s.into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(e) => {
            jni_throw(&mut env, &e.to_string());
            std::ptr::null_mut()
        }
    }
}
