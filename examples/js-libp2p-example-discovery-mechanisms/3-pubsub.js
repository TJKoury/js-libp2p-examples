/* eslint-disable no-console */

import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { bootstrap } from '@libp2p/bootstrap';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { identify } from '@libp2p/identify';
import { mplex } from '@libp2p/mplex';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p';
import { ping } from '@libp2p/ping';
import { mdns } from '@libp2p/mdns';

const createNode = async (bootstrappers = []) => {
  const config = {
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0']
    },
    transports: [tcp()],
    streamMuxers: [yamux(), mplex()],
    connectionEncryption: [noise()],
    peerDiscovery: [
      pubsubPeerDiscovery({
        interval: 1000
      }),
      mdns({
        interval: 20e3
      })
    ],
    services: {
      ping: ping({ protocolPrefix: "spacedatanetwork" }),
      pubsub: gossipsub({ emitSelf: false }),
      identify: identify()
    }
  }

  if (bootstrappers.length > 0) {
    config.peerDiscovery.push(bootstrap({
      list: bootstrappers
    }))
  }

  return await createLibp2p(config);
}

const bootstrapper = await createNode([]);

console.log(`libp2p bootstrapper started with id: ${bootstrapper.peerId.toString()}`);

const bootstrapperMultiaddrs = bootstrapper.getMultiaddrs().map((m) => m.toString());
console.log(bootstrapperMultiaddrs);
const [node1, node2] = await Promise.all([
  createNode(bootstrapperMultiaddrs),
  createNode(bootstrapperMultiaddrs)
])

node1.addEventListener('peer:discovery', (evt) => {
  const peer = evt.detail;
  console.log(`Peer ${node2.peerId.toString()} discovered: ${peer.id.toString()}`);
  console.log(peer.multiaddrs[0]);
  peer.multiaddrs.forEach(async (m) => {
    let latency = await node1.services.ping.ping(m).catch(e => { });
    if (latency !== undefined) {
      console.log(`pinged ${m} in ${latency}ms`);
    }
  });
});



setInterval(() => {
  node1.services.pubsub.publish('timestamp', new TextEncoder().encode(new Date().toISOString())).catch(e => { })
}, 500);

/************Node 2*/

node2.services.pubsub.subscribe('timestamp');
node2.services.pubsub.addEventListener('message', (message) => {
  if (message.detail.topic === "timestamp") {
    console.log(`${message.detail.topic}:`, new TextDecoder().decode(message.detail.data))
  }
});
let tt = node2.addEventListener('peer:discovery', (evt) => {
  const peer = evt.detail;
  //console.log(`Peer ${node2.peerId.toString()} discovered: ${peer.id.toString()}`);
  //console.log(peer.multiaddrs);
});

//setTimeout(() => {
// bootstrapper.stop();
// node1.stop();
// node2.stop();
//}, 10000);
