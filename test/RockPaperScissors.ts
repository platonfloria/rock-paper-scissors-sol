import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import ERC20 from "@uniswap/v2-core/build/ERC20.json";

enum GameState {
  CREATED,
  P1MOVED,
  P2MOVED,
  RESOLVED
};

enum Moves {
  UNASSIGNED,
  ROCK,
  SCISSORS,
  PAPER
};

describe("RockPaperScissors", function () {
  async function erc20Fixture() {
    const [ owner ] = await ethers.getSigners();

    const Token = await ethers.getContractFactory(ERC20.abi, ERC20.bytecode, owner);
    const token = await Token.connect(owner).deploy(1000);
    await token.waitForDeployment();
    return { token };
  }

  async function contractFixture() {
    const { token } = await loadFixture(erc20Fixture);
    const [ _, owner ] = await ethers.getSigners();

    const tokenAddress = await token.getAddress();
    const RPS = await ethers.getContractFactory("RockPaperScissors", owner);
    const contract = await upgrades.deployProxy(RPS, [tokenAddress, 50]);
    await contract.waitForDeployment();
    return { contract };
  }

  async function contractV2Fixture() {
    const { contract } = await loadFixture(contractFixture);
    const [ _, owner ] = await ethers.getSigners();

    const RockPaperScissorsV2 = await ethers.getContractFactory("RockPaperScissorsV2", owner);
    const RPS_ADDRESS = await contract.getAddress();;
    const contractV2 = await upgrades.upgradeProxy(RPS_ADDRESS, RockPaperScissorsV2);
    return { contract: contractV2, address: RPS_ADDRESS };
  }

  async function playersFixture() {
    const { token } = await loadFixture(erc20Fixture);
    const { contract, address } = await loadFixture(contractV2Fixture);
    const [ erc20Owner, owner, playerOne, playerTwo ] = await ethers.getSigners();

    await token.connect(erc20Owner).transfer(playerOne, 100);
    await token.connect(playerOne).approve(address, 100);
    await token.connect(erc20Owner).transfer(playerTwo, 100);
    await token.connect(playerTwo).approve(address, 100);
    return { playerOne, playerTwo };
  }

  function generateSecret() {
    return BigInt(ethers.toBigInt(ethers.randomBytes(32)));
  }

  function hideMove(move: Moves, secret: bigint) {
    return ethers.keccak256(ethers.toBeArray(secret ^ BigInt(move)));
  }

  describe("V1", function () {
    it("Should deploy", async function () {
      const { token } = await loadFixture(erc20Fixture);
      const { contract } = await loadFixture(contractFixture);

      expect(await contract.state()).to.equal(GameState.CREATED);
      expect(await contract.erc20()).to.equal(await token.getAddress());
      expect(await contract.price()).to.equal(50);
    });
  });

  describe("V2", function () {
    it("Should be started by player one", async function () {
      const { token } = await loadFixture(erc20Fixture);
      const { contract, address } = await loadFixture(contractV2Fixture);
      const { playerOne } = await loadFixture(playersFixture);

      const move = Moves.PAPER;
      const secret = generateSecret();
      const encryptedMove = hideMove(move, secret);
      await contract.connect(playerOne).play(encryptedMove);

      expect(await contract.state()).to.equal(GameState.P1MOVED);
      const storedPlayerAddress = await ethers.provider.getStorage(address, 2);
      expect(ethers.stripZerosLeft(storedPlayerAddress)).is.equal(playerOne.address.toLowerCase());
      const storedEncryptedMove = await ethers.provider.getStorage(address, 3);
      expect(storedEncryptedMove).is.equal(encryptedMove);
      expect(await token.balanceOf(address)).to.equal(100);
    });

    it("Should be played by player two", async function () {
      const { token } = await loadFixture(erc20Fixture);
      const { contract, address } = await loadFixture(contractV2Fixture);
      const { playerOne, playerTwo } = await loadFixture(playersFixture);

      const playerOneMove = Moves.PAPER;
      const playerOneSecret = generateSecret();
      const encryptedPlayerOneMove = hideMove(playerOneMove, playerOneSecret);
      await contract.connect(playerOne).play(encryptedPlayerOneMove);
      
      const playerTwoMove = Moves.ROCK;
      const playerTwoSecret = generateSecret();
      const encryptedPlayerTwoMove = hideMove(playerTwoMove, playerTwoSecret);
      await contract.connect(playerTwo).play(encryptedPlayerTwoMove);

      expect(await contract.state()).to.equal(GameState.P2MOVED);
      const storedOpponentAddress = await ethers.provider.getStorage(address, 5);
      expect(ethers.stripZerosLeft(storedOpponentAddress)).is.equal(playerTwo.address.toLowerCase());
      const storedPlayerTwoMove = await ethers.provider.getStorage(address, 6);
      expect(storedPlayerTwoMove).is.equal(encryptedPlayerTwoMove);
      expect(await token.balanceOf(address)).to.equal(200);
    });

    it("Should resolve", async function () {
      const { token } = await loadFixture(erc20Fixture);
      const { contract, address } = await loadFixture(contractV2Fixture);
      const { playerOne, playerTwo } = await loadFixture(playersFixture);

      const playerOneMove = Moves.SCISSORS;
      const playerOneSecret = generateSecret();
      const encryptedPlayerOneMove = hideMove(playerOneMove, playerOneSecret);
      await contract.connect(playerOne).play(encryptedPlayerOneMove);
      
      const playerTwoMove = Moves.ROCK;
      const playerTwoSecret = generateSecret();
      const encryptedPlayerTwoMove = hideMove(playerTwoMove, playerTwoSecret);
      await contract.connect(playerTwo).play(encryptedPlayerTwoMove);

      await contract.connect(playerOne).submitSecret(playerOneMove, playerOneSecret);
      const storedPlayerOneMove = await ethers.provider.getStorage(address, 4);
      expect(BigInt(storedPlayerOneMove)).is.equal(playerOneMove);
      expect(await token.balanceOf(address)).to.equal(150);
      expect(await token.balanceOf(playerOne.address)).to.equal(50);

      await contract.connect(playerTwo).submitSecret(playerTwoMove, playerTwoSecret);
      const storedPlayerTwoMove = await ethers.provider.getStorage(address, 7);
      expect(BigInt(storedPlayerTwoMove)).is.equal(playerTwoMove);
      expect(await token.balanceOf(address)).to.equal(0);
      expect(await token.balanceOf(playerOne.address)).to.equal(50);
      expect(await token.balanceOf(playerTwo.address)).to.equal(150);
  
      expect(await contract.state()).to.equal(GameState.RESOLVED);
    });

    async function playGame(playerOneMove: Moves, playerTwoMove: Moves) {
      const { token } = await loadFixture(erc20Fixture);
      const { contract, address } = await loadFixture(contractV2Fixture);
      const { playerOne, playerTwo } = await loadFixture(playersFixture);

      const playerOneSecret = generateSecret();
      const encryptedPlayerOneMove = hideMove(playerOneMove, playerOneSecret);
      await contract.connect(playerOne).play(encryptedPlayerOneMove);

      const playerTwoSecret = generateSecret();
      const encryptedPlayerTwoMove = hideMove(playerTwoMove, playerTwoSecret);
      await contract.connect(playerTwo).play(encryptedPlayerTwoMove);

      await contract.connect(playerOne).submitSecret(playerOneMove, playerOneSecret);
      await contract.connect(playerTwo).submitSecret(playerTwoMove, playerTwoSecret);

      return { token, playerOne, playerTwo };
    }

    async function verifyBalances(
      token: any,
      playerOne: any,
      playerTwo: any,
      expectedPlayerOneBalance: Number,
      expectedPlayerTwoBalance: Number
    ) {
      expect(await token.balanceOf(playerOne.address)).to.equal(expectedPlayerOneBalance);
      expect(await token.balanceOf(playerTwo.address)).to.equal(expectedPlayerTwoBalance);
    }

    it("Should calculate payout correctly for ROCK x ROCK", async function () {
      const { token, playerOne, playerTwo } = await playGame(Moves.ROCK, Moves.ROCK);
      await verifyBalances(token, playerOne, playerTwo, 100, 100);
    });

    it("Should calculate payout correctly for ROCK x PAPER", async function () {
      const { token, playerOne, playerTwo } = await playGame(Moves.ROCK, Moves.PAPER);
      await verifyBalances(token, playerOne, playerTwo, 50, 150);
    });

    it("Should calculate payout correctly for ROCK x SCISSORS", async function () {
      const { token, playerOne, playerTwo } = await playGame(Moves.ROCK, Moves.SCISSORS);
      await verifyBalances(token, playerOne, playerTwo, 150, 50);
    });

    it("Should calculate payout correctly for PAPER x ROCK", async function () {
      const { token, playerOne, playerTwo } = await playGame(Moves.PAPER, Moves.ROCK);
      await verifyBalances(token, playerOne, playerTwo, 150, 50);
    });

    it("Should calculate payout correctly for PAPER x PAPER", async function () {
      const { token, playerOne, playerTwo } = await playGame(Moves.PAPER, Moves.PAPER);
      await verifyBalances(token, playerOne, playerTwo, 100, 100);
    });

    it("Should calculate payout correctly for PAPER x SCISSORS", async function () {
      const { token, playerOne, playerTwo } = await playGame(Moves.PAPER, Moves.SCISSORS);
      await verifyBalances(token, playerOne, playerTwo, 50, 150);
    });

    it("Should calculate payout correctly for SCISSORS x ROCK", async function () {
      const { token, playerOne, playerTwo } = await playGame(Moves.SCISSORS, Moves.ROCK);
      await verifyBalances(token, playerOne, playerTwo, 50, 150);
    });

    it("Should calculate payout correctly for SCISSORS x PAPER", async function () {
      const { token, playerOne, playerTwo } = await playGame(Moves.SCISSORS, Moves.PAPER);
      await verifyBalances(token, playerOne, playerTwo, 150, 50);
    });

    it("Should calculate payout correctly for SCISSORS x SCISSORS", async function () {
      const { token, playerOne, playerTwo } = await playGame(Moves.SCISSORS, Moves.SCISSORS);
      await verifyBalances(token, playerOne, playerTwo, 100, 100);
    });
  });
});
