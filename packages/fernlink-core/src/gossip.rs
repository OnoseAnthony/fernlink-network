use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};
use uuid::Uuid;

/// In-memory seen-message cache with TTL-based eviction.
/// Equivalent to ~32 K entries at UUID size before eviction kicks in.
pub struct SeenCache {
    entries:  HashMap<Uuid, Instant>,
    order:    VecDeque<Uuid>,
    ttl:      Duration,
    capacity: usize,
}

impl SeenCache {
    pub fn new(capacity: usize, ttl: Duration) -> Self {
        Self {
            entries: HashMap::with_capacity(capacity),
            order: VecDeque::with_capacity(capacity),
            ttl,
            capacity,
        }
    }

    pub fn with_defaults() -> Self {
        Self::new(32_000, Duration::from_secs(300))
    }

    /// Returns true if the message ID is new (not yet seen).
    /// Inserts it and returns false if already seen.
    pub fn is_new(&mut self, id: Uuid) -> bool {
        self.evict_expired();
        if self.entries.contains_key(&id) {
            return false;
        }
        if self.entries.len() >= self.capacity {
            if let Some(oldest) = self.order.pop_front() {
                self.entries.remove(&oldest);
            }
        }
        self.entries.insert(id, Instant::now());
        self.order.push_back(id);
        true
    }

    fn evict_expired(&mut self) {
        let now = Instant::now();
        while let Some(&oldest) = self.order.front() {
            if let Some(&ts) = self.entries.get(&oldest) {
                if now.duration_since(ts) > self.ttl {
                    self.order.pop_front();
                    self.entries.remove(&oldest);
                } else {
                    break;
                }
            } else {
                self.order.pop_front();
            }
        }
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deduplicates_messages() {
        let mut cache = SeenCache::with_defaults();
        let id = Uuid::new_v4();
        assert!(cache.is_new(id));
        assert!(!cache.is_new(id));
    }

    #[test]
    fn different_ids_are_new() {
        let mut cache = SeenCache::with_defaults();
        assert!(cache.is_new(Uuid::new_v4()));
        assert!(cache.is_new(Uuid::new_v4()));
        assert_eq!(cache.len(), 2);
    }
}
