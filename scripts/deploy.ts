import { ethers, upgrades } from "hardhat";

async function main() {
  const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors");
  const rps = await upgrades.deployProxy(RockPaperScissors, ["0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", 0.001 * 10 ** 18]);
  await rps.waitForDeployment();
  console.log("RockPaperScissors deployed to:", await rps.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
