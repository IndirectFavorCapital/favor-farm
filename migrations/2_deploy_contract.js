const { ether } = require("@openzeppelin/test-helpers");
const fs = require("fs");
const path = require("path");

// smart contracts
const Favor = artifacts.require("Favor");
const CakeToken = artifacts.require("CakeToken");
const SyrupBar = artifacts.require("SyrupBar");
const MasterChef = artifacts.require("MasterChef");
const FarmRouter = artifacts.require("FarmRouter");
const MasterFavor = artifacts.require("MasterFavor");
//const BUSD = artifacts.require("BUSD");

// test reward token params
const FavorName = "Favor";
const FavorSymbol = "FAVOR";
const FavorSupply = "500000000"; // 5,000,000 tokens
const FavorCap = "10000000000";  // 100,000,000 tokens

module.exports = async function (deployer, network, accounts ) {
    if (network === "test") return; // skip migrations if use test network

    // Favor deployment
    console.log("Favor deployment...");
/*
    // deploy token
    await deployer.deploy(Favor, FavorName, FavorSymbol, FavorSupply, FavorCap);
    const FavorToken = await Favor.deployed();
    await deployer.deploy(CakeToken);
    const cakeToken = await CakeToken.deployed();
    await deployer.deploy(SyrupBar, cakeToken.address);
    const syrupToken = await SyrupBar.deployed();
    await deployer.deploy(MasterChef, cakeToken.address, syrupToken.address, accounts[0], '1000', '100');
    const masterChef = await MasterChef.deployed();
    //await deployer.deploy(BUSD);
    //const busd_token = await BUSD.deployed();
    await deployer.deploy(FarmRouter); 
    const farmRouter = await FarmRouter.deployed();
    await deployer.deploy(MasterFavor, FavorToken.address, '0xe6cB69edd7Fd31C178CE3C4bc47aF7A1A5A85e9c', '0xD99D1c33F9fC3444f8101754aBC46c52416550D1', '0x83f7F3aE82c575eb7380a449bFB6DA3ffdAd11d6', '0x83f7F3aE82c575eb7380a449bFB6DA3ffdAd11d6', accounts[0], masterChef.address, cakeToken.address, 100, 100, farmRouter.address);
    */
    await deployer.deploy(Favor, 'LP2', 'LP2', 500000000, 10000000000);
    const LP1 = await Favor.deployed();
    
}
