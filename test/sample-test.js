const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { solidity } =  require("ethereum-waffle");
const rawdata = require('./rawdata.json')

describe("FGSEXCHANGE contract", function () {

  let Token;
  let fgsToken;
  let FGXExchange;
  let fgs;
  let FGSAdd;
  let owner;
  let addr1;
  let addr2;
  let addrs;

 
  beforeEach(async function () { 
    
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
      Token = await ethers.getContractFactory("FungaNomicsToken"); 
      fgsToken = await Token.deploy(); 
  
      FGXExchange = await ethers.getContractFactory("FGSExchangeV1Test"); 
      fgs = await upgrades.deployProxy(FGXExchange, [
        "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526",fgsToken.address,10], 
        { initializer: 'Initialize' });

        FGSAdd = await fgs.deployed();
  });


  describe("admin functions", function () {

      
    it("Should set the right owner", async function () {
      expect(await fgs.owner()).to.equal(owner.address);
    });

    
    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await fgsToken.balanceOf(owner.address);
      expect(await fgsToken.totalSupply()).to.equal(ownerBalance);
    });


    it("Should transfer some  supply of tokens to the fgs contract", async function () {
      await fgsToken.transfer(fgs.address,1000000000)
      const fgxexchangebalance = await fgsToken.balanceOf(fgs.address);
      expect(fgxexchangebalance).to.equal(1000000000);
    }); 
 
    
    it("owner should able to change token price", async function () {
      await fgs.connect(owner).changeTokenPrice(50)
      expect(await fgs.tokenPrice()).to.equal(50);
    }); 


    it("owner should able to change staking apr", async function () {
      await fgs.connect(owner).changeStakingAPR(12,1200)
      expect(await fgs.stakingPeriodsAPY(12)).to.equal(1200);
    }); 


    it("transfer ownership", async function () {
      await fgs.connect(owner).transferOwnership(addr1.address)
      expect(await fgs.owner()).to.equal(addr1.address);
    }); 

  });


  describe("Buy and Stake", function () {


    it("user should able to call buyAndStake", async function () {

     let tx = await fgs.connect(addr1).BuyAndStake(12, {value: "100000000000000000" })

      let logs = await tx.wait();

      // console.log("events0", logs.events[0]);

      let purchaseId = parseInt(Number(logs.events[0].topics[2]));
      // console.log("pid", purchaseId);

      let purchaseinfo = Object.assign({}, await fgs.purchases(purchaseId));
      // console.log("pinfo", purchaseinfo);
      // console.log("investedamount", parseInt(purchaseinfo.investedamount));
      expect(addr1.address).to.equal(purchaseinfo.User);
     }); 
    }) 
 

  describe("Stake", function () {

    it("user should able to call Stake", async function () {
      
      await fgsToken.transfer(addr1.address,"1000000000000000000")
      await fgsToken.connect(addr1).approve(fgs.address, "1000000000000000000")
      let tx = await fgs.connect(addr1).Stake("1000000000000000000",12)

      let logs = await tx.wait();

      // console.log("events0", logs.events[0]);

      let purchaseId = parseInt(Number(logs.events[0].topics[2]));
      // console.log("pid", purchaseId);

      let purchaseinfo = Object.assign({}, await fgs.purchases(purchaseId));
      // console.log("pinfo", purchaseinfo);
      // console.log("investedamount", parseInt(purchaseinfo.investedamount));
      expect(addr1.address).to.equal(purchaseinfo.User);
      }); 
    })  

  
  describe("Buy and Vest", function () {

    it("user should able to call BuyAndVest", async function () {
      await fgsToken.transfer(fgs.address,"100000000000000000000000")
      let tx = await fgs.connect(addr1).BuyAndVesting({value: "1000000000000000" })

      let logs = await tx.wait();

      // console.log("events0", logs.events[0]);

      let purchaseId = parseInt(Number(logs.events[0].topics[2]));
      // console.log("pid", purchaseId);

      let purchaseinfo = Object.assign({}, await fgs.purchases(purchaseId));
      // console.log("pinfo", purchaseinfo);
      // console.log("investedamount", parseInt(purchaseinfo.investedamount));
      expect(addr1.address).to.equal(purchaseinfo.User);
      });   
   });


   describe("Manual Vesting", function () {

    it("only owner should able to add list of old users", async function () {
      await expect(fgs.connect(addr1).manualVestingEntryOwner(rawdata)).to.be.revertedWith("Ownable: caller is not the owner")
      }); 


    it("owner should able to to add users", async function () {
       await fgs.connect(owner).manualVestingEntryOwner(rawdata); 
       expect(await fgs.totalPurchases()).to.equal(rawdata.length);
    }); 

    it("old users can claim their tokens", async function () {

      let data =  [
        [ addr1.address,"25000000000000000000000","25000000000000000000000",1628706600,0,"12500000000000000000000",1644486600,1,"50",false ],
        [ addr2.address,"16800000000000000000000","16800000000000000000000",1638469800,0,"4200000000000000000000",1646359800,1,"25",false ],
      ];
        
        let tx = await fgsToken.transfer(fgs.address,"1000000000000000000000000")
        await tx.wait();
        
        let tx2 = await fgs.connect(owner).manualVestingEntryOwner(data); 
        await tx2.wait();
        
        let tx3 = await fgs.connect(addr1).claim(0);
        await tx3.wait();

        let tx4 = await fgs.connect(addr2).claim(1);
        await tx4.wait();

        await expect(fgs.connect(addr2).claim(1)).to.be.revertedWith("First Vesting: You can withdraw only once")
         
        console.log("user1 balance", await fgsToken.balanceOf(addr1.address));
        console.log("pinfo", await fgs.purchases(0));

        console.log("user2 balance", await fgsToken.balanceOf(addr2.address));
        console.log("pinfo", await fgs.purchases(1));
    }); 

 })  


   describe("Claim", function () {

    it("user should able to call buyAndStake and claim after 12 months", async function () {
         
      await fgsToken.transfer(fgs.address,"100000000000000000000000")
     let tx = await fgs.connect(addr1).BuyAndStake(12, {value: "100000000000000000" })

      let logs = await tx.wait();

      // console.log("events0", logs.events[0]);

      let purchaseId = parseInt(Number(logs.events[0].topics[2]));
      // console.log("pid", purchaseId);

      let purchaseinfo = Object.assign({}, await fgs.purchases(purchaseId));
      // console.log("pinfo", purchaseinfo.totalamount);

      const oneyear = 365 * 24 * 60 * 60;
      
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;

      // console.log(blockNumBefore);
      // console.log(blockBefore);
      // console.log(timestampBefore);

      await ethers.provider.send('evm_increaseTime', [oneyear]);
      await ethers.provider.send('evm_mine');

      const blockNumAfter = await ethers.provider.getBlockNumber();
      const blockAfter = await ethers.provider.getBlock(blockNumAfter);
      const timestampAfter = blockAfter.timestamp;
       
      // console.log(blockNumAfter);
      // console.log(blockAfter);
      // console.log(timestampAfter);    
      
      await fgs.connect(addr1).claim(purchaseId);
      
      expect(await fgsToken.balanceOf(addr1.address)).to.equal(purchaseinfo.totalamount);

      // expect(blockNumAfter).to.be.equal(blockNumBefore + 1);
      // expect(timestampAfter).to.be.equal(timestampBefore + oneyear);
     });  


    it("user should able to call buyAndStake and claim after 18 months", async function () {
         
    await fgsToken.transfer(fgs.address,"100000000000000000000000")
     let tx = await fgs.connect(addr1).BuyAndStake(18, {value: "100000000000000000" })

      let logs = await tx.wait();

      let purchaseId = parseInt(Number(logs.events[0].topics[2]));

      let purchaseinfo = Object.assign({}, await fgs.purchases(purchaseId));

      const oneyear = 548 * 24 * 60 * 60;     // 18 months
      
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;

      await ethers.provider.send('evm_increaseTime', [oneyear]);
      await ethers.provider.send('evm_mine');

      const blockNumAfter = await ethers.provider.getBlockNumber();
      const blockAfter = await ethers.provider.getBlock(blockNumAfter);
      const timestampAfter = blockAfter.timestamp;
       
      await fgs.connect(addr1).claim(purchaseId);
      
      expect(await fgsToken.balanceOf(addr1.address)).to.equal(purchaseinfo.totalamount);
     }); 
     
     it("user should able to call buyAndStake and claim after 24 months", async function () {
         
      await fgsToken.transfer(fgs.address,"100000000000000000000000")
       let tx = await fgs.connect(addr1).BuyAndStake(18, {value: "100000000000000000" })
  
        let logs = await tx.wait();
  
        let purchaseId = parseInt(Number(logs.events[0].topics[2]));
  
        let purchaseinfo = Object.assign({}, await fgs.purchases(purchaseId));
  
        const oneyear = 731 * 24 * 60 * 60;
        
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;

        await ethers.provider.send('evm_increaseTime', [oneyear]);
        await ethers.provider.send('evm_mine');
  
        const blockNumAfter = await ethers.provider.getBlockNumber();
        const blockAfter = await ethers.provider.getBlock(blockNumAfter);
        const timestampAfter = blockAfter.timestamp;
        await fgs.connect(addr1).claim(purchaseId);
        
        expect(await fgsToken.balanceOf(addr1.address)).to.equal(purchaseinfo.totalamount);
       }); 


       it("user should able to call buyAndStake and claim after 36 months", async function () {
         
        await fgsToken.transfer(fgs.address,"100000000000000000000000")
         let tx = await fgs.connect(addr1).BuyAndStake(18, {value: "100000000000000000" })
    
          let logs = await tx.wait();
    
          let purchaseId = parseInt(Number(logs.events[0].topics[2]));
    
          let purchaseinfo = Object.assign({}, await fgs.purchases(purchaseId));
    
          const oneyear = 1096 * 24 * 60 * 60;
          
          const blockNumBefore = await ethers.provider.getBlockNumber();
          const blockBefore = await ethers.provider.getBlock(blockNumBefore);
          const timestampBefore = blockBefore.timestamp;
    
          await ethers.provider.send('evm_increaseTime', [oneyear]);
          await ethers.provider.send('evm_mine');
    
          const blockNumAfter = await ethers.provider.getBlockNumber();
          const blockAfter = await ethers.provider.getBlock(blockNumAfter);
          const timestampAfter = blockAfter.timestamp;
        
          await fgs.connect(addr1).claim(purchaseId);
          
          expect(await fgsToken.balanceOf(addr1.address)).to.equal(purchaseinfo.totalamount);
         });

         it("user should able to call buyAndStake and claim after 48 months", async function () {
         
          await fgsToken.transfer(fgs.address,"100000000000000000000000")
           let tx = await fgs.connect(addr1).BuyAndStake(18, {value: "100000000000000000" })
      
            let logs = await tx.wait();
      
            let purchaseId = parseInt(Number(logs.events[0].topics[2]));
      
            let purchaseinfo = Object.assign({}, await fgs.purchases(purchaseId));
      
            const oneyear = 1461 * 24 * 60 * 60;
            
            const blockNumBefore = await ethers.provider.getBlockNumber();
            const blockBefore = await ethers.provider.getBlock(blockNumBefore);
            const timestampBefore = blockBefore.timestamp;
      
            await ethers.provider.send('evm_increaseTime', [oneyear]);
            await ethers.provider.send('evm_mine');
      
            const blockNumAfter = await ethers.provider.getBlockNumber();
            const blockAfter = await ethers.provider.getBlock(blockNumAfter);
            const timestampAfter = blockAfter.timestamp;
            
            await fgs.connect(addr1).claim(purchaseId);
            
            expect(await fgsToken.balanceOf(addr1.address)).to.equal(purchaseinfo.totalamount);
           });
         
           it("user should able to call buyandVest and claim their tokens", async function () {
         
            await fgsToken.transfer(fgs.address,"100000000000000000000000")
             
            let tx = await fgs.connect(addr1).BuyAndVesting({value: "100000000000000000" })
            let logs = await tx.wait();
        
              let purchaseId = parseInt(Number(logs.events[0].topics[2]));
        
              let purchaseinfo = Object.assign({}, await fgs.purchases(purchaseId));
              console.log("pinfo", purchaseinfo.totalamount);
            
              // round1 claim
              let theemonths = 7890000;
              
              let blockNumBefore = await ethers.provider.getBlockNumber();
              let blockBefore = await ethers.provider.getBlock(blockNumBefore);
              let timestampBefore = blockBefore.timestamp;
        
              await ethers.provider.send('evm_increaseTime', [theemonths]);
              await ethers.provider.send('evm_mine');
        
              let blockNumAfter = await ethers.provider.getBlockNumber();
              let blockAfter = await ethers.provider.getBlock(blockNumAfter);
              let timestampAfter = blockAfter.timestamp;
            
              await fgs.connect(addr1).claim(purchaseId);

              // round2 claim
              theemonths = 7890000;
              
              blockNumBefore = await ethers.provider.getBlockNumber();
              blockBefore = await ethers.provider.getBlock(blockNumBefore);
              timestampBefore = blockBefore.timestamp;
        
              await ethers.provider.send('evm_increaseTime', [theemonths]);
              await ethers.provider.send('evm_mine');
        
              blockNumAfter = await ethers.provider.getBlockNumber();
              blockAfter = await ethers.provider.getBlock(blockNumAfter);
              timestampAfter = blockAfter.timestamp;
            
              await fgs.connect(addr1).claim(purchaseId);
              // await fgs.connect(addr1).claim(purchaseId);
              
              // round3 claim
              theemonths = 7890000;
              
              blockNumBefore = await ethers.provider.getBlockNumber();
              blockBefore = await ethers.provider.getBlock(blockNumBefore);
              timestampBefore = blockBefore.timestamp;
        
              await ethers.provider.send('evm_increaseTime', [theemonths]);
              await ethers.provider.send('evm_mine');
        
              blockNumAfter = await ethers.provider.getBlockNumber();
              blockAfter = await ethers.provider.getBlock(blockNumAfter);
              timestampAfter = blockAfter.timestamp;
            
              await fgs.connect(addr1).claim(purchaseId);
            
              // console.log(await fgsToken.balanceOf(addr1.address)); 
              
              expect(await fgsToken.balanceOf(addr1.address)).to.equal(purchaseinfo.totalamount);
        
             });    
    }) 

}); 