import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CC2J5M2OOUU2UDSSAD5CE6UUKGWPHY2B225CCYG5LJSTV6YUPRNBIXXI",
  }
} as const


export interface Client {
  /**
   * Construct and simulate a constructor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  constructor: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a max_uint64_uint64 transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  max_uint64_uint64: ({a, b}: {a: u64, b: u64}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a max_uint64_uint64_uint64 transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  max_uint64_uint64_uint64: ({a, b, c}: {a: u64, b: u64, c: u64}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAALY29uc3RydWN0b3IAAAAAAAAAAAA=",
        "AAAAAAAAAAAAAAARbWF4X3VpbnQ2NF91aW50NjQAAAAAAAACAAAAAAAAAAFhAAAAAAAABgAAAAAAAAABYgAAAAAAAAYAAAABAAAABg==",
        "AAAAAAAAAAAAAAAYbWF4X3VpbnQ2NF91aW50NjRfdWludDY0AAAAAwAAAAAAAAABYQAAAAAAAAYAAAAAAAAAAWIAAAAAAAAGAAAAAAAAAAFjAAAAAAAABgAAAAEAAAAG",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAAAAAABAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    constructor: this.txFromJSON<null>,
        max_uint64_uint64: this.txFromJSON<u64>,
        max_uint64_uint64_uint64: this.txFromJSON<u64>
  }
}