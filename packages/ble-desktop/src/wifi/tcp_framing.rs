use std::io::{Read, Write};
use anyhow::{bail, Result};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub const TYPE_REQUEST: u8 = 0x01;
pub const TYPE_PROOF:   u8 = 0x02;

/// Write one framed message: [typeTag: 1 byte][length: 4 bytes BE][payload]
pub fn write_frame(stream: &mut impl Write, type_tag: u8, payload: &[u8]) -> Result<()> {
    let len = payload.len() as u32;
    stream.write_all(&[type_tag])?;
    stream.write_all(&len.to_be_bytes())?;
    stream.write_all(payload)?;
    stream.flush()?;
    Ok(())
}

/// Read one complete frame. Blocks until the full frame is received.
/// Returns (typeTag, payload) or None on clean EOF.
pub fn read_frame(stream: &mut impl Read) -> Result<Option<(u8, Vec<u8>)>> {
    let mut header = [0u8; 5];
    match stream.read_exact(&mut header) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e.into()),
    }
    let type_tag = header[0];
    let length   = u32::from_be_bytes([header[1], header[2], header[3], header[4]]) as usize;
    if length > 1_048_576 { bail!("frame too large: {length}"); }

    let mut payload = vec![0u8; length];
    stream.read_exact(&mut payload)?;
    Ok(Some((type_tag, payload)))
}

// ── Async variants (Tokio) ────────────────────────────────────────────────────

pub async fn write_frame_async(
    stream: &mut (impl AsyncWriteExt + Unpin),
    type_tag: u8,
    payload: &[u8],
) -> Result<()> {
    let len = payload.len() as u32;
    stream.write_all(&[type_tag]).await?;
    stream.write_all(&len.to_be_bytes()).await?;
    stream.write_all(payload).await?;
    stream.flush().await?;
    Ok(())
}

pub async fn read_frame_async(
    stream: &mut (impl AsyncReadExt + Unpin),
) -> Result<Option<(u8, Vec<u8>)>> {
    let mut header = [0u8; 5];
    match stream.read_exact(&mut header).await {
        Ok(_)  => {}
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e.into()),
    }
    let type_tag = header[0];
    let length   = u32::from_be_bytes([header[1], header[2], header[3], header[4]]) as usize;
    if length > 1_048_576 { bail!("frame too large: {length}"); }
    let mut payload = vec![0u8; length];
    stream.read_exact(&mut payload).await?;
    Ok(Some((type_tag, payload)))
}
