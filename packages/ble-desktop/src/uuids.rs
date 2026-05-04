// "fern" → "fe4e": f,e are valid hex; 4e is the ASCII code for 'N' (the
// last letter of FERN), giving us "FeN" — a valid 128-bit UUID prefix.
// All three platform layers (Rust, Kotlin, TypeScript) must use these values.

use uuid::{uuid, Uuid};

pub const FERNLINK_SERVICE: Uuid = uuid!("fe4e0000-0000-1000-8000-00805f9b34fb");
pub const CHAR_REQUEST:     Uuid = uuid!("fe4e0001-0000-1000-8000-00805f9b34fb");
pub const CHAR_PROOF:       Uuid = uuid!("fe4e0002-0000-1000-8000-00805f9b34fb");
pub const CHAR_STATUS:      Uuid = uuid!("fe4e0003-0000-1000-8000-00805f9b34fb");

/// Standard BLE descriptor for enabling notifications.
pub const DESCRIPTOR_CCC: Uuid = uuid!("00002902-0000-1000-8000-00805f9b34fb");

pub const MTU: usize = 512;
pub const FRAG_HEADER: usize = 2;
pub const MAX_PAYLOAD: usize = MTU - FRAG_HEADER;
