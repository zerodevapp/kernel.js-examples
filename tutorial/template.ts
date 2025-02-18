import "dotenv/config";
import { createPublicClient, encodeFunctionData, http, parseAbi } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { getEntryPoint } from "@zerodev/sdk/constants";

if (!process.env.ZERODEV_PROJECT_ID) {
  throw new Error("ZERODEV_PROJECT_ID is not set");
}

const BUNDLER_RPC = `https://rpc.zerodev.app/api/v2/bundler/${process.env.ZERODEV_PROJECT_ID}`;
const PAYMASTER_RPC = `https://rpc.zerodev.app/api/v2/paymaster/${process.env.ZERODEV_PROJECT_ID}`;

// The NFT contract we will be interacting with
const contractAddress = "0x34bE7f35132E97915633BC1fc020364EA5134863";
const contractABI = parseAbi([
  "function mint(address _to) public",
  "function balanceOf(address owner) external view returns (uint256 balance)",
]);

// Construct a public client
const publicClient = createPublicClient({
  transport: http(BUNDLER_RPC),
});

const chain = sepolia;
const entryPoint = getEntryPoint("0.7");

const main = async () => {
  // your code goes here
};

main();
