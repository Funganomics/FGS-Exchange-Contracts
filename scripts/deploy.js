const { ethers, upgrades } = require('hardhat')

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log(`Deploying FGSExchange contract with the account: ${deployer.address}`)
  
	const fgxexchange = await ethers.getContractFactory('FGSExchangeV1')
	console.log('Deploying fgsexchange...')
  const proxy = await upgrades.deployProxy(fgxexchange, [
	"0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526","0x75F58dcEc150532773642dda53a75205869C31bf",10], 
  { initializer: 'Initialize' });
	await proxy.deployed()
	console.log('fgsexchange deployed to:', proxy.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});