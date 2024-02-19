deploy:
	npx hardhat run scripts/deploy.ts --network sepolia

upgrade:
	npx hardhat run scripts/upgradeV2.ts --network sepolia

tests:
	npx hardhat test
