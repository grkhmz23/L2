import { keccak256 } from 'js-sha3';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

/**
 * Compute keccak256 hash of concatenated little-endian bytes.
 * Matches Rust: `hashv(&[&amount.to_le_bytes(), &nonce.to_le_bytes(), &bidder.to_bytes()])`
 *
 * @param amount - u64 bid amount
 * @param nonce - u64 random nonce
 * @param bidder - bidder pubkey (32 bytes)
 * @returns 32-byte hash as Uint8Array
 */
export function computeCommitHash(
  amount: BN | bigint | number,
  nonce: BN | bigint | number,
  bidder: PublicKey
): Uint8Array {
  const amountBytes = toLeBytes64(amount);
  const nonceBytes = toLeBytes64(nonce);
  const bidderBytes = bidder.toBytes();

  const data = new Uint8Array(8 + 8 + 32);
  data.set(amountBytes, 0);
  data.set(nonceBytes, 8);
  data.set(bidderBytes, 16);

  const hex = keccak256(data);
  return hexToUint8Array(hex);
}

function toLeBytes64(value: BN | bigint | number): Uint8Array {
  const bn = value instanceof BN ? value : new BN(value.toString());
  const bytes = bn.toArray('le', 8);
  return new Uint8Array(bytes);
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Re-export sha256 from js-sha3 for spec hashing.
 */
export { sha3_256 as sha256 } from 'js-sha3';

/**
 * Test vectors for Rust-TS parity verification.
 * These same vectors are tested in Rust (programs/sable/src/policy.rs).
 */
export const COMMIT_HASH_TEST_VECTORS: Array<{
  amount: number;
  nonce: number;
  bidder: string; // base58 pubkey
  expectedHashHex: string;
}> = [
  {
    amount: 100,
    nonce: 42,
    bidder: '11111111111111111111111111111111',
    expectedHashHex:
      '212b3806c02335536147cc08dc78025686002eb74dc19d89f434d1ed5d0039ef',
  },
  {
    amount: 0,
    nonce: 0,
    bidder: '11111111111111111111111111111111',
    expectedHashHex:
      'c980e59163ce244bb4bb6211f48c7b46f88a4f40943e84eb99bdc41e129bd293',
  },
  {
    amount: 18446744073709551615,
    nonce: 18446744073709551615,
    bidder: 'SaSAXcdWhyr1KD8TKRg6K7WPuxcPLZJHKEwsjQgL5Di',
    expectedHashHex:
      '93dda10a1b9a91b0ddde7a19bbe3f8d69856bc728065011f9035897d2001fcdc',
  },
];
