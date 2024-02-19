import { ethers, upgrades } from "hardhat";

async function main() {
  const RockPaperScissorsV2 = await ethers.getContractFactory("RockPaperScissorsV2");
  const RPS_ADDRESS = "0xB7A9302BD1eb2AE744bC32a708b89F3CAB10809b";
  await upgrades.upgradeProxy(RPS_ADDRESS, RockPaperScissorsV2);
  console.log("RockPaperScissors upgraded to V2");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
