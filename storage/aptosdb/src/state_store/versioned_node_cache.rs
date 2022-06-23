// Copyright (c) Aptos
// SPDX-License-Identifier: Apache-2.0

use super::Node;
use aptos_infallible::RwLock;
use aptos_jellyfish_merkle::node_type::NodeKey;
use aptos_types::transaction::Version;
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
};

type NodeCache = HashMap<NodeKey, Node>;

#[derive(Debug)]
pub(crate) struct VersionedNodeCache {
    inner: RwLock<VecDeque<(Version, Arc<NodeCache>)>>,
}

impl VersionedNodeCache {
    const NUM_VERSIONS_TO_CACHE: usize = 2;

    pub fn new() -> Self {
        Self {
            inner: RwLock::new(Default::default()),
        }
    }

    pub fn add_version(&self, version: Version, nodes: NodeCache) {
        let mut locked = self.inner.write();
        if !locked.is_empty() {
            let (last_version, _) = locked.back().unwrap();
            assert!(
                *last_version < version,
                "Updating older version. {} vs latest:{} ",
                version,
                *last_version,
            );

            if locked.len() >= Self::NUM_VERSIONS_TO_CACHE {
                locked.pop_front();
            }
        }
        locked.push_back((version, Arc::new(nodes)));
    }

    pub fn get_version(&self, version: Version) -> Option<Arc<NodeCache>> {
        self.inner
            .read()
            .iter()
            .rev()
            .find(|(ver, _nodes)| *ver == version)
            .map(|(_ver, nodes)| nodes.clone())
    }
}
