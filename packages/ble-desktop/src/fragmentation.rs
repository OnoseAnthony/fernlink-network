use crate::uuids::{FRAG_HEADER, MAX_PAYLOAD};
use anyhow::{bail, Result};

/// Split `payload` into MTU-sized BLE fragments.
/// Each fragment is prefixed with [index: u8, total: u8].
pub fn fragment(payload: &[u8]) -> Result<Vec<Vec<u8>>> {
    let chunks: Vec<&[u8]> = payload.chunks(MAX_PAYLOAD).collect();
    if chunks.len() > 255 {
        bail!("payload too large to fragment ({} bytes)", payload.len());
    }
    let total = chunks.len() as u8;
    Ok(chunks
        .iter()
        .enumerate()
        .map(|(i, chunk)| {
            let mut frag = Vec::with_capacity(FRAG_HEADER + chunk.len());
            frag.push(i as u8);
            frag.push(total);
            frag.extend_from_slice(chunk);
            frag
        })
        .collect())
}

/// Stateful reassembler for a single BLE message stream.
#[derive(Default)]
pub struct Reassembler {
    slots: Vec<Option<Vec<u8>>>,
    received: usize,
}

impl Reassembler {
    pub fn feed(&mut self, frag: &[u8]) -> Option<Vec<u8>> {
        if frag.len() < FRAG_HEADER {
            return None;
        }
        let index = frag[0] as usize;
        let total = frag[1] as usize;
        let payload = &frag[FRAG_HEADER..];

        if self.slots.is_empty() {
            self.slots = vec![None; total];
        }
        if index >= self.slots.len() {
            return None;
        }
        if self.slots[index].is_none() {
            self.slots[index] = Some(payload.to_vec());
            self.received += 1;
        }
        if self.received == self.slots.len() {
            let complete = self.slots.iter().flatten().flat_map(|v| v.iter().copied()).collect();
            self.reset();
            return Some(complete);
        }
        None
    }

    pub fn reset(&mut self) {
        self.slots.clear();
        self.received = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_small() {
        let data = b"hello fernlink";
        let frags = fragment(data).unwrap();
        let mut r = Reassembler::default();
        let mut result = None;
        for f in frags {
            result = r.feed(&f);
        }
        assert_eq!(result.unwrap(), data);
    }

    #[test]
    fn roundtrip_multi_fragment() {
        let data = vec![0xABu8; MAX_PAYLOAD * 3 + 17];
        let frags = fragment(&data).unwrap();
        assert_eq!(frags.len(), 4);
        let mut r = Reassembler::default();
        let mut result = None;
        for f in frags {
            result = r.feed(&f);
        }
        assert_eq!(result.unwrap(), data);
    }
}
