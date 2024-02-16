import "dotenv/config"
import {
  createKernelAccount,
  createZeroDevPaymasterClient,
  createKernelAccountClient,
  addressToEmptyAccount,
} from "@zerodev/sdk"
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator"
import {
  signerToSessionKeyValidator,
  ParamOperator,
  serializeSessionKeyAccount,
  deserializeSessionKeyAccount,
  oneAddress,
} from "@zerodev/session-key"
import { UserOperation } from "permissionless"
import {
  http,
  Hex,
  createPublicClient,
  parseAbi,
  encodeFunctionData,
  Address,
  zeroAddress,
  toFunctionSelector,
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { polygonMumbai } from "viem/chains"

if (
  !process.env.BUNDLER_RPC ||
  !process.env.PAYMASTER_RPC ||
  !process.env.PRIVATE_KEY
) {
  throw new Error("BUNDLER_RPC or PAYMASTER_RPC or PRIVATE_KEY is not set")
}

const publicClient = createPublicClient({
  transport: http(process.env.BUNDLER_RPC),
})

const signer = privateKeyToAccount(process.env.PRIVATE_KEY as Hex)
const contractAddress = "0x34bE7f35132E97915633BC1fc020364EA5134863"
const contractABI = parseAbi([
  "function mint(address _to) public",
  "function balanceOf(address owner) external view returns (uint256 balance)",
])

const createSessionKey = async (sessionKeyAddress: Address) => {
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
  })

  const masterAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
  })
  console.log("Account address:", masterAccount.address)

  // Create an "empty account" as the signer -- you only need the public
  // key (address) to do this.
  const emptySessionKeySigner = addressToEmptyAccount(sessionKeyAddress)

  const sessionKeyValidator = await signerToSessionKeyValidator(publicClient, {
    signer: emptySessionKeySigner,
    validatorData: {
      paymaster: oneAddress,
      permissions: [
        {
          target: contractAddress,
          // Maximum value that can be transferred.  In this case we
          // set it to zero so that no value transfer is possible.
          valueLimit: BigInt(0),
          // Contract abi
          abi: contractABI,
          // Function name
          functionName: "mint",
          // An array of conditions, each corresponding to an argument for
          // the function.
          args: [
            {
              // In this case, we are saying that the session key can only mint
              // NFTs to the account itself
              operator: ParamOperator.EQUAL,
              value: masterAccount.address,
            },
          ],
        },
      ],
    },
  })

  const sessionKeyAccount = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
      regular: sessionKeyValidator,
      executorData: {
        executor: zeroAddress,
        selector: toFunctionSelector("executeDelegateCall(address, bytes)"),
      },
    },
  })

  return await serializeSessionKeyAccount(sessionKeyAccount)
}

const useSessionKey = async (serializedSessionKey: string, sessionKeySigner: any) => {
  const sessionKeyAccount = await deserializeSessionKeyAccount(publicClient, serializedSessionKey, sessionKeySigner)

  const kernelClient = createKernelAccountClient({
    account: sessionKeyAccount,
    chain: polygonMumbai,
    transport: http(process.env.BUNDLER_RPC),
    sponsorUserOperation: async ({ userOperation }): Promise<UserOperation> => {
      const kernelPaymaster = createZeroDevPaymasterClient({
        chain: polygonMumbai,
        transport: http(process.env.PAYMASTER_RPC),
      })
      return kernelPaymaster.sponsorUserOperation({
        userOperation,
      })
    },
  })

  const userOpHash = await kernelClient.sendUserOperation({
    userOperation: {
      callData: await sessionKeyAccount.encodeCallData({
        to: contractAddress,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: contractABI,
          functionName: "mint",
          args: [sessionKeyAccount.address],
        }),
        callType: 'delegatecall',
      }),
    },
  })

  console.log("userOp hash:", userOpHash)
}

const main = async () => {

  // The agent creates a public-private key pair and sends
  // the public key (address) to the owner.
  const sessionPrivateKey = generatePrivateKey()
  const sessionKeySigner = privateKeyToAccount(sessionPrivateKey)

  // The owner authorizes the public key by signing it and sending
  // back the signature
  const serializedSessionKey = await createSessionKey(sessionKeySigner.address)

  // The agent constructs a full session key
  await useSessionKey(serializedSessionKey, sessionKeySigner)

}

main()
