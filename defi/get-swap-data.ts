import "dotenv/config"
import {
  createKernelAccount,
  createZeroDevPaymasterClient,
  createKernelAccountClient,
} from "@zerodev/sdk"
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import { ENTRYPOINT_ADDRESS_V07, bundlerActions } from "permissionless"
import { http, Hex, createPublicClient } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { arbitrum } from "viem/chains"
import { baseTokenAddresses, createKernelDefiClient } from "@zerodev/defi"
import { KERNEL_V3_1 } from "@zerodev/sdk/constants";

if (
  !process.env.PRIVATE_KEY ||
  !process.env.ZERODEV_PROJECT_ID
) {
  throw new Error("PRIVATE_KEY or ZERODEV_PROJECT_ID is not set")
}
const projectId = process.env.ZERODEV_PROJECT_ID
const bundlerRpc = `https://rpc.zerodev.app/api/v2/bundler/${projectId}`
const paymasterRpc = `https://rpc.zerodev.app/api/v2/paymaster/${projectId}`
const chain = arbitrum
const publicClient = createPublicClient({
  transport: http(bundlerRpc),
  chain
})

const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex)

const entryPoint = ENTRYPOINT_ADDRESS_V07

const main = async () => {
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint,
    kernelVersion: KERNEL_V3_1
  })

  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint,
    kernelVersion: KERNEL_V3_1
  })
  console.log("My account:", account.address)

  const kernelClient = createKernelAccountClient({
    account,
    entryPoint,
    chain,
    bundlerTransport: http(bundlerRpc),
    middleware: {
      sponsorUserOperation: async ({ userOperation }) => {
        const paymasterClient = createZeroDevPaymasterClient({
          chain,
          transport: http(paymasterRpc),
          entryPoint,
        })
        return paymasterClient.sponsorUserOperation({
          userOperation,
          entryPoint,
        })
      },
    },
  });
  const defiClient = createKernelDefiClient(kernelClient, projectId)

  try {
    const swapData = await defiClient.getSwapData({
      fromAddress: account.address,
      fromToken: baseTokenAddresses[chain.id].USDC,
      fromAmount: BigInt("1000"),
      toAddress: account.address,
      toToken: baseTokenAddresses[chain.id].USDT,
      chainId: chain.id,
      slippage: 300, // in basis
    })
    const userOpHash = await defiClient.sendUserOperation({
      userOperation: {
        callData: await defiClient.account.encodeCallData({
          to: swapData.targetAddress,
          data: swapData.callData,
          value: swapData.value,
          callType: "delegatecall"
        })
      },
    })
  
    console.log("userOp hash:", userOpHash)
  
    const bundlerClient = kernelClient.extend(bundlerActions(entryPoint))
    await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    })
  
    console.log("userOp completed")
  } catch (e) {
    console.error(e);
  }
}

main()
