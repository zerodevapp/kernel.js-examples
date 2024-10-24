// Utilities for examples

import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { createEcdsaKernelAccountClient } from "@zerodev/presets/zerodev";
import {
  KernelAccountClient,
  KernelSmartAccount,
  SponsorUserOperationParameters,
  createKernelAccount,
  createKernelAccountClient,
  createKernelAccountV1,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { GetKernelVersion } from "@zerodev/sdk/types";
import { ENTRYPOINT_ADDRESS_V06, ENTRYPOINT_ADDRESS_V07 } from "permissionless";
import { SmartAccount } from "permissionless/accounts";
import { Middleware } from "permissionless/actions/smartAccount";
import {
  ENTRYPOINT_ADDRESS_V06_TYPE,
  EntryPoint,
} from "permissionless/types/entrypoint";
import { Chain, Hex, Transport, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonMumbai, sepolia } from "viem/chains";

const zeroDevProjectId = process.env.ZERODEV_PROJECT_ID;
const privateKey = process.env.PRIVATE_KEY;
if (!zeroDevProjectId || !privateKey) {
  throw new Error("ZERODEV_PROJECT_ID or PRIVATE_KEY is not set");
}

const signer = privateKeyToAccount(privateKey as Hex);
const chain = sepolia;
const publicClient = createPublicClient({
  transport: http(process.env.BUNDLER_RPC),
  chain
});

export const getKernelClient = async <entryPoint extends EntryPoint>(
  entryPointAddress: entryPoint,
  kernelVersion: GetKernelVersion<entryPoint>
) => {
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint: entryPointAddress,
    kernelVersion
  });

  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint: entryPointAddress,
    kernelVersion
  });
  console.log("My account:", account.address);

  return createKernelAccountClient({
    account,
    entryPoint: entryPointAddress,
    chain,
    bundlerTransport: http(process.env.BUNDLER_RPC),
    middleware: {
      sponsorUserOperation: async ({ userOperation }) => {
        const paymasterClient = createZeroDevPaymasterClient({
          chain,
          transport: http(process.env.PAYMASTER_RPC),
          entryPoint: entryPointAddress,
        });
        const _userOperation =
          userOperation as SponsorUserOperationParameters<entryPoint>["userOperation"];
        return paymasterClient.sponsorUserOperation({
          userOperation: _userOperation,
          entryPoint: entryPointAddress,
        });
      },
    },
  });
};

export const getKernelV1Account = async () => {
  const privateKey = process.env.PRIVATE_KEY as Hex;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable not set");
  }

  const rpcUrl = process.env.BUNDLER_RPC;
  if (!rpcUrl) {
    throw new Error("BUNDLER_RPC environment variable not set");
  }

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
    chain
  });
  const signer = privateKeyToAccount(privateKey);

  return createKernelAccountV1(publicClient, {
    signer,
    index: BigInt(0),
    entryPoint: ENTRYPOINT_ADDRESS_V06,
  }) as unknown as KernelSmartAccount<
    ENTRYPOINT_ADDRESS_V06_TYPE,
    Transport,
    typeof chain
  >;
};

export const getKernelV1AccountClient = async ({
  account,
  middleware,
}: Middleware<ENTRYPOINT_ADDRESS_V06_TYPE> & {
  account: KernelSmartAccount<ENTRYPOINT_ADDRESS_V06_TYPE, Transport, typeof chain>
}) => {
  const zeroDevBundlerRpcHost = process.env.BUNDLER_RPC;
  return createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(zeroDevBundlerRpcHost),
    middleware,
    entryPoint: ENTRYPOINT_ADDRESS_V06,
  })
};

export const getZeroDevPaymasterClient = <entryPoint extends EntryPoint>(
  entryPointAddress: entryPoint
) => {
  if (!process.env.PAYMASTER_RPC)
    throw new Error("PAYMASTER_RPC environment variable not set");

  const paymasterRpc = process.env.PAYMASTER_RPC;

  return createZeroDevPaymasterClient({
    chain,
    transport: http(paymasterRpc),
    entryPoint: entryPointAddress,
  });
};

export const getZeroDevERC20PaymasterClient = <entryPoint extends EntryPoint>(
  entryPointAddress: entryPoint
) => {
  if (!process.env.ZERODEV_PROJECT_ID)
    throw new Error("ZERODEV_PROJECT_ID environment variable not set");

  return createZeroDevPaymasterClient({
    chain,
    transport: http(
      process.env.PAYMASTER_RPC ||
        "https://rpc.zerodev.app/api/v2/paymaster/" +
          process.env.ZERODEV_PROJECT_ID
    ),
    entryPoint: entryPointAddress,
  });
};
