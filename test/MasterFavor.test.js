const { time } = require("@openzeppelin/test-helpers");
const {advanceBlock } = require("@openzeppelin/test-helpers/src/time");
const { ether } = require("@openzeppelin/test-helpers");
const { assert } = require('chai');
const CakeToken = artifacts.require('CakeToken');
const SyrupBar = artifacts.require('SyrupBar');
const MasterFavor = artifacts.require('MasterFavor');
const Favor = artifacts.require('Favor');
const FarmRouter = artifacts.require('FarmRouter');
const MasterChef = artifacts.require('MasterChef');
const BEP20Token = artifacts.require('BEP20Token');
const PancakeFactory = artifacts.require('PancakeFactory');
const PancakeRouter = artifacts.require('PancakeRouter');
const PancakePair = artifacts.require('PancakePair');
const PancakeLibrary = artifacts.require('PancakeLibrary');
const MockBEP20 = artifacts.require('MockBEP20');

function reward(percent, time1, time2, favorPerBlock, amount, totalAmount){
  return Math.trunc(percent*(time2 - time1)*favorPerBlock*amount/(2*totalAmount));
}

function pendingHonor(Honor, totalAmount, deposit_in_last_period){
  return Math.trunc(totalAmount / deposit_in_last_period * Honor);
}

contract('MasterFavor', ([alice, bob, carol, dev, minter]) => {
  beforeEach(async () => {
    // test reward token params
    this.FavorName = 'Favor';
    this.FavorSymbol = 'FAVOR';
    this.FavorSupply = ether("500000000000000"); // 5,000,000 tokens
    this.FavorCap = ether("31000000000000000");  // 100,000,000 tokens
    this.favor = await Favor.new(this.FavorName, this.FavorSymbol, this.FavorSupply, this.FavorCap, { from: minter });

    //deploy MasterChef from PancakeSwap
    this.cake = await CakeToken.new({ from: minter });
    this.syrup = await SyrupBar.new(this.cake.address, { from: minter });
    this.BUSD = await BEP20Token.new({ from: minter });

    await this.cake.mint(minter, 5000000000, {from: minter});
    await this.syrup.mint(minter, 500000000, {from: minter});
    this.chef = await MasterChef.new(
                                  this.cake.address, 
                                  this.syrup.address, 
                                  dev, 
                                  '1000', 
                                  '100', 
                                  { from: minter }
                                 );
    await this.cake.transferOwnership(this.chef.address, { from: minter });
    await this.syrup.transferOwnership(this.chef.address, { from: minter });

    this.pancakeFactory = await PancakeFactory.new(this.cake.address, { from: minter });
    this.pancakeRouter = await PancakeRouter.new(this.pancakeFactory.address, minter, { from: minter });
    this.farmRouter = await FarmRouter.new({ from: minter });

    this.favor_BUSD_LP_pool = await this.pancakeFactory.createPair(this.BUSD.address, this.favor.address);
    this.cake_favor_LP_pool = await this.pancakeFactory.createPair(this.cake.address, this.favor.address);

    this.favor_BUSD_pair_address = await this.favor_BUSD_LP_pool.logs[0].args.pair;
    this.cake_favor_pair_address = await this.cake_favor_LP_pool.logs[0].args.pair;
   
    this.masterFavor = await MasterFavor.new(
                                           this.favor.address,
                                           this.BUSD.address,
                                           this.pancakeRouter.address,
                                           this.favor_BUSD_pair_address,
                                           this.cake_favor_pair_address,
                                           minter,
                                           this.chef.address,
                                           this.cake.address,
                                           100,
                                           this.farmRouter.address, { from: minter }
                                          );
  
   await this.favor.mint(999999, {from: minter});

   await this.BUSD.approve(this.masterFavor.address, 99999999999, {from: minter});
   await this.favor.approve(this.masterFavor.address, 99999999999, {from: minter});

   await this.BUSD.approve(this.masterFavor.address, 99999999999, {from: bob});
   await this.favor.approve(this.masterFavor.address, 99999999999, {from: bob});

   await this.BUSD.approve(this.masterFavor.address, 99999999999, {from: bob});
   await this.favor.approve(this.masterFavor.address, 99999999999, {from: bob});

   await this.favor.transfer(this.favor_BUSD_pair_address, 99999999999, {from: minter});
   await this.BUSD.transfer(this.favor_BUSD_pair_address, 99999999999, {from: minter});

   await this.favor.transfer(this.cake_favor_pair_address, 999999, {from: minter});
   await this.cake.transfer(this.cake_favor_pair_address, 999999, {from: minter});

   this.favor_BUSD_pair = await PancakePair.at(this.favor_BUSD_pair_address);
   this.favor_cake_pair = await PancakePair.at(this.cake_favor_pair_address); 

   await this.favor_BUSD_pair.sync();
   await this.favor_cake_pair.sync();
                                                     
   this.lp1 = await MockBEP20.new('LPToken', 'LP1', '999999', { from: minter });
   this.lp2 = await MockBEP20.new('LPToken', 'LP2', '999999', { from: minter });
   this.lp3 = await MockBEP20.new('LPToken', 'LP3', '999999', { from: minter });
   
   await this.lp1.transfer(bob, '200', { from: minter });
   await this.lp1.transfer(alice, '200', { from: minter });
   await this.lp1.transfer(carol, '200', { from: minter });


   await this.lp2.transfer(bob, '200', { from: minter });
   await this.lp2.transfer(alice, '200', { from: minter });
   await this.lp2.transfer(carol, '200', { from: minter });

   await this.lp3.transfer(bob, '200', { from: minter });
   await this.lp3.transfer(alice, '200', { from: minter });
   await this.lp3.transfer(carol, '200', { from: minter });

   await this.chef.add(100, this.lp2.address, true, {from: minter});
   await this.cake.transfer(this.chef.address, '10000', {from: minter});

   await this.masterFavor.add_LP_token(this.favor.address, { from: minter });
   await this.masterFavor.add_LP_token(this.favor_BUSD_pair_address, { from: minter });
   await this.masterFavor.add_LP_token(this.cake_favor_pair_address, { from: minter });
   await this.masterFavor.add_LP_token(this.lp1.address, { from: minter });
   await this.masterFavor.add_LP_token(this.lp2.address, { from: minter });
   await this.masterFavor.add_LP_token(this.lp3.address, { from: minter });
      
   await this.lp1.approve(this.masterFavor.address, '1000000000000', { from: minter });
   await this.lp1.approve(this.masterFavor.address, '1000000000000', { from: bob });
   await this.lp1.approve(this.masterFavor.address, '1000000000000', { from: alice });
   await this.lp1.approve(this.masterFavor.address, '1000000000000', { from: carol });

   await this.lp2.approve(this.masterFavor.address, '1000000000000', { from: minter });
   await this.lp2.approve(this.masterFavor.address, '1000000000000', { from: bob });
   await this.lp2.approve(this.masterFavor.address, '1000000000000', { from: alice });
   await this.lp2.approve(this.masterFavor.address, '1000000000000', { from: carol });

   await this.lp2.approve(this.chef.address, '1000000000000', { from: minter });
   await this.lp2.approve(this.chef.address, '1000000000000', { from: bob });
   await this.lp2.approve(this.chef.address, '1000000000000', { from: alice });
   await this.lp2.approve(this.chef.address, '1000000000000', { from: carol });

   await this.lp3.approve(this.masterFavor.address, '1000000000000', { from: minter });
   await this.lp3.approve(this.masterFavor.address, '1000000000000', { from: bob });
   await this.lp3.approve(this.masterFavor.address, '1000000000000', { from: alice });
   await this.lp3.approve(this.masterFavor.address, '1000000000000', { from: carol });

   await this.lp3.approve(this.chef.address, '1000000000000', { from: minter });
   await this.lp3.approve(this.chef.address, '1000000000000', { from: bob });
   await this.lp3.approve(this.chef.address, '1000000000000', { from: alice });
   await this.lp3.approve(this.chef.address, '1000000000000', { from: carol });
   await this.favor.transfer(this.masterFavor.address, 100000000, {from: minter});
  });

  it('favorWithdraw/BUSDWithdraw', async () => {
    await this.masterFavor.addFavorWell(dev, 1000000, 50, 312, 99999999, {from: minter});
    assert.equal((await this.favor.balanceOf(this.masterFavor.address)).toString(), '100000000');
    assert.equal((await this.BUSD.balanceOf(this.masterFavor.address)).toString(), '0');
    assert.equal((await this.favor.balanceOf(minter)).toString(), '499999999999999999999899900000001');
    assert.equal((await this.BUSD.balanceOf(minter)).toString(), '30999999999999900000000001');

    await this.masterFavor.makeContribution(dev, {from: minter});

    assert.equal((await this.favor.balanceOf(this.masterFavor.address)).toString(), '100498997');
    assert.equal((await this.BUSD.balanceOf(this.masterFavor.address)).toString(), '50000');
    assert.equal((await this.favor.balanceOf(minter)).toString(), '499999999999999999999899900000001');
    assert.equal((await this.BUSD.balanceOf(minter)).toString(), '30999999999999899999450001');

    await this.masterFavor.favorWithdraw(100, {from: minter});
    await this.masterFavor.BUSDWithdraw(1000, {from: minter});

    assert.equal((await this.favor.balanceOf(this.masterFavor.address)).toString(), '100498897');
    assert.equal((await this.favor.balanceOf(minter)).toString(), '499999999999999999999899900000101');
    assert.equal((await this.BUSD.balanceOf(this.masterFavor.address)).toString(), '49000');
    assert.equal((await this.BUSD.balanceOf(minter)).toString(), '30999999999999899999451001');
  });

  it('add farm, contribution and initial fee', async () => {
    await this.masterFavor.addFavorWell(dev, 10000, 1, 999999999, 99999999, {from: minter});
    await this.masterFavor.addFavorWell(alice, 10000, 10, 999999999, 99999999, {from: minter});
    await this.masterFavor.addFavorWell(bob, 10000, 30, 999999999, 99999999, {from: minter});
    await this.masterFavor.addFavorWell(carol, 10000, 50, 999999999, 99999999, {from: minter});

    assert.equal((await this.BUSD.balanceOf(this.masterFavor.address)).toNumber(), 0);
    assert.equal((await this.favor.balanceOf(this.masterFavor.address)).toNumber(), 100000000);

    await this.masterFavor.makeContribution(alice, {from: minter});
    assert.equal((await this.BUSD.balanceOf(this.masterFavor.address)).toNumber(), 500);
    assert.equal((await this.favor.balanceOf(this.masterFavor.address)).toNumber(), 100000997);

    await this.masterFavor.makeContribution(bob, {from: minter});
    assert.equal((await this.BUSD.balanceOf(this.masterFavor.address)).toNumber(), 1000);
    assert.equal((await this.favor.balanceOf(this.masterFavor.address)).toNumber(), 100003990);

    await this.masterFavor.makeContribution(carol, {from: minter});
    assert.equal((await this.BUSD.balanceOf(this.masterFavor.address)).toNumber(), 1500);
    assert.equal((await this.favor.balanceOf(this.masterFavor.address)).toNumber(), 100008979);

  });

  it('deposit/withdraw', async () => {
    await this.masterFavor.addFavorWell(dev, 10000, 1, 999999999, 99999999, {from: minter});
    await this.masterFavor.addFavorWell(alice, 10000, 10, 999999999, 99999999, {from: minter});
    await this.masterFavor.addFavorWell(bob, 10000, 30, 999999999, 99999999, {from: minter});
    await this.masterFavor.addFavorWell(carol, 10000, 50, 999999999, 99999999, {from: minter});

    await this.masterFavor.makeContribution(alice, {from: minter});
    await this.masterFavor.makeContribution(bob, {from: minter});
    await this.masterFavor.makeContribution(carol, {from: minter});

    assert.equal((await this.lp1.balanceOf(this.masterFavor.address)).toNumber(), 0);
    await this.masterFavor.deposit(3, 10, true, {from: alice});
    assert.equal((await this.lp1.balanceOf(this.masterFavor.address)).toNumber(), 10);
    this.time_1_alice = (await time.latest()).toNumber();
    this.favor_balance_1_alice = (await this.favor.balanceOf(alice)).toNumber();
    await time.increase(7);
    await this.masterFavor.withdraw(3, 1, true, {from: alice});
    assert.equal((await this.lp1.balanceOf(this.masterFavor.address)).toNumber(), 9);
    this.time_2_alice = (await time.latest()).toNumber();
    this.favor_balance_2_alice = (await this.favor.balanceOf(alice)).toNumber();
    assert.equal(
            this.favor_balance_2_alice - this.favor_balance_1_alice,
            reward(2.1, this.time_1_alice, this.time_2_alice, 100, 10, 10)
           );
           
    await this.masterFavor.deposit(9, 19, true, {from: bob});
    assert.equal((await this.lp1.balanceOf(this.masterFavor.address)).toNumber(), 28);
    this.time_1_bob = (await time.latest()).toNumber();
    this.favor_balance_1_bob = (await this.favor.balanceOf(bob)).toNumber();
    await time.increase(5);
    await this.masterFavor.deposit(9, 1, true, {from: bob});
    assert.equal((await this.lp1.balanceOf(this.masterFavor.address)).toNumber(), 29);
    this.time_2_bob = (await time.latest()).toNumber();
    this.favor_balance_2_bob = (await this.favor.balanceOf(bob)).toNumber();
    assert.equal(
            this.favor_balance_2_bob - this.favor_balance_1_bob,
            reward(2.1, this.time_1_bob, this.time_2_bob, 100, 19, 19)
           );

    await this.masterFavor.deposit(15, 7, true, {from: bob});
    assert.equal((await this.lp1.balanceOf(this.masterFavor.address)).toNumber(), 36);
    this.time_1_bob = (await time.latest()).toNumber();
    this.favor_balance_1_bob = (await this.favor.balanceOf(bob)).toNumber();
    await time.increase(13);
    await this.masterFavor.withdraw(15, 7, true, {from: bob});
    assert.equal((await this.lp1.balanceOf(this.masterFavor.address)).toNumber(), 29);
    this.time_2_bob = (await time.latest()).toNumber();
    this.favor_balance_2_bob = (await this.favor.balanceOf(bob)).toNumber();
    assert.equal(
            this.favor_balance_2_bob - this.favor_balance_1_bob,
            reward(2.2, this.time_1_bob, this.time_2_bob, 100, 15, 15)
           );

    await this.masterFavor.deposit(18, 4, true, {from: bob});
    this.time_1_bob = (await time.latest()).toNumber();
    this.favor_balance_1_bob = (await this.favor.balanceOf(bob)).toNumber();
    await time.increase(18);
    await this.masterFavor.withdraw(18, 2, true, {from: bob});
    this.time_2_bob = (await time.latest()).toNumber();
    this.favor_balance_2_bob = (await this.favor.balanceOf(bob)).toNumber();
    assert.equal(
            this.favor_balance_2_bob - this.favor_balance_1_bob - 2,
            reward(2.3, this.time_1_bob, this.time_2_bob, 100, 4, 4)
           );
  });

  it('interaction with pancakeswap', async () => {
    await this.masterFavor.addFavorWell(dev, 99999, 1, 999999999, 99999999, {from: minter});

    this.rout_contract_alice = (await this.masterFavor.users(alice));
    assert.equal(this.rout_contract_alice.toString(), '0x0000000000000000000000000000000000000000');
 
    await this.masterFavor.deposit(4, 10, true, {from: alice});
    this.time_1_alice = (await time.latest()).toNumber();
    this.favor_balance_1_alice = (await this.favor.balanceOf(alice)).toNumber();
    this.favor_balance_1_masterFavor = (await this.favor.balanceOf(this.masterFavor.address)).toNumber();

    this.rout_contract_alice = (await this.masterFavor.users(alice));
    this.rout_contract_bob = (await this.masterFavor.users(bob));
    assert.notEqual(this.rout_contract_alice.toString(), '0x0000000000000000000000000000000000000000');
    assert.equal(this.rout_contract_bob.toString(), '0x0000000000000000000000000000000000000000');

    this.lp_token_num = ((await this.masterFavor.LP_tokens_for_farm(4)).pancakeSwapPoolId).toNumber();
    assert.equal(this.lp_token_num, 1);
    assert.equal((await this.cake.balanceOf(this.rout_contract_alice)).toNumber(), 0);
    assert.equal((await this.favor.balanceOf(this.rout_contract_alice)).toNumber(), 0);
    assert.equal((await this.lp2.balanceOf(this.rout_contract_alice)).toNumber(), 0);

    await time.increase(70);

    await this.masterFavor.deposit(4, 10, false, {from: bob});
    this.time_1_bob = (await time.latest()).toNumber();
    this.favor_balance_1_bob = (await this.favor.balanceOf(bob)).toNumber();

    await time.increase(11);
    await time.advanceBlock(10);

    await this.masterFavor.withdraw(4, 4, true, {from: alice});
    assert.equal((await this.lp2.balanceOf(this.masterFavor.address)).toNumber(), 10);
    assert.equal((await this.lp2.balanceOf(this.chef.address)).toNumber(), 6);
    this.time_2_alice = (await time.latest()).toNumber();
    this.favor_balance_2_alice = (await this.favor.balanceOf(alice)).toNumber();
    this.diff = Math.abs(
                    this.favor_balance_2_alice - 
                    this.favor_balance_1_alice - 
                    reward(2.1, this.time_1_alice, this.time_2_alice, 100, 10, 10)
                );


    if (this.diff < 100){
      throw new Error(
                  `Did not receive rewards from pancake swap`
                );
    }

    await this.masterFavor.deposit(4, 10, true, {from: bob});
    this.time_2_bob = (await time.latest()).toNumber();
    this.favor_balance_2_bob = (await this.favor.balanceOf(bob)).toNumber();
    assert.equal(this.favor_balance_2_bob - this.favor_balance_1_bob, reward(2.1, this.time_1_bob, this.time_2_bob, 100, 10, 16));
    this.time_1_bob = this.time_2_bob;
    this.favor_balance_1_bob = this.favor_balance_2_bob;
    this.favor_balance_1_masterFavor = (await this.favor.balanceOf(this.masterFavor.address)).toNumber();

    this.rout_contract_bob = (await this.masterFavor.users(bob));
    assert.notEqual(this.rout_contract_bob.toString(), '0x0000000000000000000000000000000000000000');

    await time.increase(90);

    await this.masterFavor.deposit(4, 10, true, {from: bob});
    this.time_2_bob = (await time.latest()).toNumber();
    this.favor_balance_2_bob = (await this.favor.balanceOf(bob)).toNumber();
    this.diff = Math.abs(
                    this.favor_balance_2_bob - 
                    this.favor_balance_1_bob - 
                    reward(2.1, this.time_1_bob, this.time_2_bob, 100, 20, 26)
                );

    if (this.diff <= 200){
      throw new Error(
                  `Did not receive awards from pancake swap`
                );
    }

    assert.equal((await this.lp2.balanceOf(alice)).toNumber(), 194);
    assert.equal((await this.lp2.balanceOf(bob)).toNumber(), 170);
    assert.equal((await this.lp2.balanceOf(this.masterFavor.address)).toNumber(), 10);
    assert.equal((await this.lp2.balanceOf(this.chef.address)).toNumber(), 26);
    assert.equal((await this.cake.balanceOf(this.rout_contract_alice)).toNumber(), 0);
    assert.equal((await this.favor.balanceOf(this.rout_contract_alice)).toNumber(), 0);
    assert.equal((await this.lp2.balanceOf(this.rout_contract_alice)).toNumber(), 0);
    assert.equal((await this.cake.balanceOf(this.rout_contract_bob)).toNumber(), 0);
    assert.equal((await this.favor.balanceOf(this.rout_contract_bob)).toNumber(), 0);
    assert.equal((await this.lp2.balanceOf(this.rout_contract_bob)).toNumber(), 0);
  });


  it('non profit, raised funds', async () => {
    await this.masterFavor.addFavorWell(dev, 99999, 1, 999999999, 99999999, {from: minter});
    
    await this.masterFavor.deposit(3, 10, true, {from: alice});
    this.init_time = (await time.latest()).toNumber();
    this.time_1_alice = (await time.latest()).toNumber();
    this.favor_balance_1_alice = (await this.favor.balanceOf(alice)).toNumber();
    await time.increase(30);
    await this.masterFavor.withdraw(3, 1, true, {from: alice});
    this.time_2_alice = (await time.latest()).toNumber();
    this.favor_balance_2_alice = (await this.favor.balanceOf(alice)).toNumber();

    assert.equal(
      this.favor_balance_2_alice - this.favor_balance_1_alice, 
      reward(2.1, this.time_1_alice, 
      this.time_2_alice, 100, 10, 10)
    );

    await this.masterFavor.deposit(3, 100, true, {from: bob});
    this.time_1_bob = (await time.latest()).toNumber();
    this.favor_balance_1_bob = (await this.favor.balanceOf(bob)).toNumber();
    await time.increase(53);
    await this.masterFavor.deposit(3, 1, true, {from: bob});
    this.time_2_bob = (await time.latest()).toNumber();
    this.favor_balance_2_bob = (await this.favor.balanceOf(bob)).toNumber();

    assert.equal(
      this.favor_balance_2_bob - this.favor_balance_1_bob, 
      reward(2.1, this.time_1_bob, this.time_2_bob, 100, 100, 109)
    );
  
    await this.masterFavor.deposit(5, 67, true, {from: carol});
    this.time_1_carol = (await time.latest()).toNumber();
    this.favor_balance_1_carol = (await this.favor.balanceOf(carol)).toNumber();
    await time.increase(71);
    await this.masterFavor.deposit(5, 95, true, {from: carol});
    this.time_2_carol = (await time.latest()).toNumber();
    this.favor_balance_2_carol = (await this.favor.balanceOf(carol)).toNumber();

    assert.equal(
      this.favor_balance_2_carol - this.favor_balance_1_carol, 
      reward(2.1, this.time_1_carol, this.time_2_carol, 100, 67, 67)
    );

    await time.increase(5000);

    assert.equal(0, (await this.favor.balanceOf(dev)).toNumber());

    await this.masterFavor.deposit(5, 1, true, {from: carol});
    this.final_time = (await time.latest()).toNumber();;
    this.favor_balance_final_carol = (await this.favor.balanceOf(carol)).toNumber();

    assert.equal(
      (await this.masterFavor.getAmountOut(99999, this.BUSD.address, this.favor.address)).toNumber(), 
      (await this.favor.balanceOf(dev)).toNumber()
    );

    assert.equal(
      this.favor_balance_final_carol - this.favor_balance_2_carol, 
      reward(2.1, this.time_2_carol, this.final_time, 100, 162, 162)
    );

    await this.masterFavor.withdraw(5, 163, true, {from: carol});
    assert.equal(
      (await this.masterFavor.getAmountOut(99999, this.BUSD.address, this.favor.address)).toNumber(), 
      (await this.favor.balanceOf(dev)).toNumber()
    );

    assert.equal(this.favor_balance_final_carol - (await this.favor.balanceOf(carol)).toNumber(), 0);

    await this.masterFavor.withdraw(3, 9, true, {from: alice});
    this.favor_balance_final_alice = (await this.favor.balanceOf(alice)).toNumber();
    assert.equal(
      (await this.masterFavor.getAmountOut(99999, this.BUSD.address, this.favor.address)).toNumber(), 
      (await this.favor.balanceOf(dev)).toNumber()
    );

    assert.equal(
      this.favor_balance_final_alice - this.favor_balance_2_alice, 
      reward(2.1, this.time_2_alice, this.final_time, 100, 9, 110)
    );

    await this.masterFavor.withdraw(3, 101, true, {from: bob});
    this.favor_balance_final_bob = (await this.favor.balanceOf(bob)).toNumber();
    assert.equal(
      (await this.masterFavor.getAmountOut(99999, this.BUSD.address, this.favor.address)).toNumber(), 
      (await this.favor.balanceOf(dev)).toNumber()
    );

    assert.equal(
      this.favor_balance_final_bob - this.favor_balance_2_bob, 
      reward(2.1, this.time_2_bob, this.final_time, 100, 101, 110)
    );

  });

  it('non profit, didnt raise funds', async () => {
    await this.masterFavor.addFavorWell(dev, 99999999999, 1, 4000, 99999999, {from: minter});
    
    await this.masterFavor.deposit(3, 10, true, {from: alice});
    this.init_time = (await time.latest()).toNumber();
    this.time_1_alice = (await time.latest()).toNumber();
    this.favor_balance_1_alice = (await this.favor.balanceOf(alice)).toNumber();
    await time.increase(30);
    await this.masterFavor.withdraw(3, 1, true, {from: alice});
    this.time_2_alice = (await time.latest()).toNumber();
    this.favor_balance_2_alice = (await this.favor.balanceOf(alice)).toNumber();

    assert.equal(
      this.favor_balance_2_alice - this.favor_balance_1_alice, 
      reward(2.1, this.time_1_alice, this.time_2_alice, 100, 10, 10)
    );

    await this.masterFavor.deposit(3, 100, true, {from: bob});
    this.time_1_bob = (await time.latest()).toNumber();
    this.favor_balance_1_bob = (await this.favor.balanceOf(bob)).toNumber();
    await time.increase(53);
    await this.masterFavor.deposit(3, 1, true, {from: bob});
    this.time_2_bob = (await time.latest()).toNumber();
    this.favor_balance_2_bob = (await this.favor.balanceOf(bob)).toNumber();

    assert.equal(
      this.favor_balance_2_bob - this.favor_balance_1_bob, 
      reward(2.1, this.time_1_bob, 
      this.time_2_bob, 100, 100, 109)
    );
  
    await this.masterFavor.deposit(5, 67, true, {from: carol});
    this.time_1_carol = (await time.latest()).toNumber();
    this.favor_balance_1_carol = (await this.favor.balanceOf(carol)).toNumber();
    await time.increase(71);
    await this.masterFavor.deposit(5, 95, true, {from: carol});
    this.time_2_carol = (await time.latest()).toNumber();
    this.favor_balance_2_carol = (await this.favor.balanceOf(carol)).toNumber();

    assert.equal(
      this.favor_balance_2_carol - this.favor_balance_1_carol, 
      reward(2.1, this.time_1_carol, this.time_2_carol, 100, 67, 67)
    );

    await time.increase(5000);

    assert.equal(0, (await this.favor.balanceOf(dev)).toNumber());

    await this.masterFavor.withdraw(5, 1, true, {from: carol});
    this.final_time = this.init_time + 4000;
    this.favor_balance_final_carol = (await this.favor.balanceOf(carol)).toNumber();
    this.final_balance = (await this.favor.balanceOf(dev)).toNumber();
    
    assert.equal(
      this.favor_balance_final_carol - this.favor_balance_2_carol, 
      reward(2.1, this.time_2_carol, this.final_time, 100, 162, 162)
    );
    
    await this.masterFavor.withdraw(5, 161, true, {from: carol});
    assert.equal(this.favor_balance_final_carol - (await this.favor.balanceOf(carol)).toNumber(), 0);

    await this.masterFavor.withdraw(3, 4, true, {from: alice});
    this.favor_balance_final_alice = (await this.favor.balanceOf(alice)).toNumber();

    assert.equal(
      this.favor_balance_final_alice - this.favor_balance_2_alice, 
      reward(2.1, this.time_2_alice, this.final_time, 100, 9, 110)
    );

    await this.masterFavor.withdraw(3, 5, true, {from: alice});
    assert.equal(this.favor_balance_final_alice - (await this.favor.balanceOf(alice)).toNumber(), 0);

    await this.masterFavor.withdraw(3, 99, true, {from: bob});
    this.favor_balance_final_bob = (await this.favor.balanceOf(bob)).toNumber();
    
    assert.equal(this.favor_balance_final_bob - this.favor_balance_2_bob, 
                 reward(2.1, this.time_2_bob, this.final_time, 100, 101, 110));

    await this.masterFavor.withdraw(3, 2, true, {from: bob});
    assert.equal(this.favor_balance_final_bob - (await this.favor.balanceOf(bob)).toNumber(), 0);
    
  });
 
  it('commercial, didnt raise funds. Part 1', async () => {

    this.init_balance = (await this.favor.balanceOf(this.masterFavor.address)).toNumber();

    await this.masterFavor.addFavorWell(dev, 99999999999, 10, 312, 99999999, {from: minter});
    await this.masterFavor.makeContribution(dev, {from: minter});

    this.balance_after_contribution = (await this.favor.balanceOf(this.masterFavor.address)).toNumber();
    this.paidReward = 0;

    await this.masterFavor.deposit(3, 10, true, {from: alice});
    this.init_time = (await time.latest()).toNumber();
    await time.increase(30);
    this.favor_balance_1_alice = (await this.favor.balanceOf(alice)).toNumber();
    await this.masterFavor.withdraw(3, 1, true, {from: alice});
    this.favor_balance_2_alice = (await this.favor.balanceOf(alice)).toNumber();
    this.paidReward += this.favor_balance_2_alice - this.favor_balance_1_alice;

    await this.masterFavor.deposit(3, 100, true, {from: bob});
    await time.increase(53);
    this.favor_balance_1_bob = (await this.favor.balanceOf(bob)).toNumber();
    await this.masterFavor.deposit(3, 1, true, {from: bob});
    this.time_2_bob = (await time.latest()).toNumber();
    this.favor_balance_2_bob = (await this.favor.balanceOf(bob)).toNumber();
    this.paidReward += this.favor_balance_2_bob - this.favor_balance_1_bob;

    await this.masterFavor.deposit(5, 67, true, {from: carol});
    this.favor_balance_1_carol = (await this.favor.balanceOf(carol)).toNumber();
    await time.increase(71);
    await this.masterFavor.deposit(5, 95, true, {from: carol});
    this.time_2_carol = (await time.latest()).toNumber();
    this.favor_balance_2_carol = (await this.favor.balanceOf(carol)).toNumber();
    this.paidReward += this.favor_balance_2_carol - this.favor_balance_1_carol;

    await time.increase(5000);

    assert.equal(0, (await this.favor.balanceOf(dev)).toNumber());

    await this.masterFavor.withdraw(5, 1, true, {from: carol});
    this.final_time = this.init_time + 312;
    this.favor_balance_final_carol = (await this.favor.balanceOf(carol)).toNumber();
    this.final_balance = (await this.favor.balanceOf(dev)).toNumber();
    
    this.paidReward += this.favor_balance_final_carol - this.favor_balance_2_carol;

    await this.masterFavor.withdraw(5, 161, true, {from: carol});
    assert.equal(this.favor_balance_final_carol - (await this.favor.balanceOf(carol)).toNumber(), 0);

    await this.masterFavor.withdraw(3, 4, true, {from: alice});
    this.favor_balance_final_alice = (await this.favor.balanceOf(alice)).toNumber();
    this.paidReward += this.favor_balance_final_alice - this.favor_balance_2_alice;

    await this.masterFavor.withdraw(3, 5, true, {from: alice});
    assert.equal(this.favor_balance_final_alice - (await this.favor.balanceOf(alice)).toNumber(), 0);

    this.pendingrewardBob = reward(2.1, this.time_2_bob, this.final_time, 100, 101, 110);
    this.paidReward += this.pendingrewardBob;

    this.favor_balance_1_alice = (await this.favor.balanceOf(alice)).toNumber();

    await this.masterFavor.getHonor(dev, {from: alice});
    this.favor_balance_2_alice = (await this.favor.balanceOf(alice)).toNumber();

    this.deposit_in_last_period = ((await this.masterFavor.favorCompanyInformation(dev, 0)).deposit_in_last_period).toNumber();
    
    this.HonorAmount = pendingHonor(
                          this.favor_balance_1_alice, 
                          this.balance_after_contribution - this.init_balance + this.paidReward, 
                          this.deposit_in_last_period
                       );

    if (Math.abs(this.deposit_in_last_period - this.paidReward) > 2){
      throw new Error(
                  `Incorrect deposit_in_last_period`
                  );
    }
    if (Math.abs(this.HonorAmount - this.favor_balance_2_alice + this.favor_balance_1_alice) > 2){
                throw new Error(
                  `Incorrect honor amount`
                );
    }
    this.favor_balance_1_bob = (await this.favor.balanceOf(bob)).toNumber();
    await this.masterFavor.getHonor(dev, {from: bob});
    this.favor_balance_2_bob = (await this.favor.balanceOf(bob)).toNumber();
    this.HonorAmount = pendingHonor(
                          this.favor_balance_1_bob + this.pendingrewardBob, 
                          this.balance_after_contribution - this.init_balance + this.paidReward,
                          this.deposit_in_last_period
                       );

    if (Math.abs(this.HonorAmount - this.favor_balance_2_bob + this.favor_balance_1_bob + this.pendingrewardBob) > 2){
                throw new Error(
                  `Incorrect honor amount`
                );
    }
  });

  it('commercial, didnt raise funds. Part 2', async () => {
    this.init_balance = (await this.favor.balanceOf(this.masterFavor.address)).toNumber();

    await this.masterFavor.addFavorWell(dev, 999999999, 10, 11031, 99999999, {from: minter});
    await this.masterFavor.makeContribution(dev, {from: minter});

    this.balance_after_contribution = (await this.favor.balanceOf(this.masterFavor.address)).toNumber();
    this.paidReward = 0;
    this.pending_deposit_in_last_period = 0;
    this.alice_honor = 0;
    
    await this.masterFavor.deposit(3, 10, true, {from: alice});

    this.init_time = (await time.latest()).toNumber();
    await time.increase(5);

    await this.masterFavor.deposit(5, 7, true, {from: alice});
    await this.masterFavor.deposit(3, 100, true, {from: bob});

    await time.increase(53);

    await this.masterFavor.deposit(3, 1, true, {from: bob});
    this.last_time_bob = (await time.latest()).toNumber();
    await this.masterFavor.deposit(5, 4, true, {from: alice});

    await time.increase(5);

    await this.masterFavor.withdraw(5, 11, true, {from: alice});
    await this.masterFavor.withdraw(3, 10, true, {from: alice});

    this.pending_deposit_in_last_period -= (await this.favor.balanceOf(alice)).toNumber();
    this.alice_honor -= (await this.favor.balanceOf(alice)).toNumber();

    await time.increase(10);

    await this.masterFavor.deposit(3, 33, true, {from: alice});
    this.last_time_alice_pool_3 = (await time.latest()).toNumber();

    await time.increase(10);

    await this.masterFavor.deposit(5, 4, true, {from: alice});
    this.last_time_alice_pool_5 = (await time.latest()).toNumber();

    await time.increase(20091);

    await this.masterFavor.withdraw(3, 0, true, {from: bob});
    this.final_time = this.init_time + 11031; 

    this.pendingRewardAlice = reward(2.1, this.last_time_alice_pool_3, this.final_time, 100, 33, 134) +
                              reward(2.1, this.last_time_alice_pool_5, this.final_time, 100, 4, 4);    

    this.paidReward = (await this.favor.balanceOf(alice)).toNumber() +
                      (await this.favor.balanceOf(bob)).toNumber() +
                      this.pendingRewardAlice;

    this.pending_deposit_in_last_period += this.paidReward;
    this.alice_honor += (await this.favor.balanceOf(alice)).toNumber() +
                        this.pendingRewardAlice;

    this.balance_alice_befor_honor = (await this.favor.balanceOf(alice)).toNumber();
    this.balance_bob_befor_honor = (await this.favor.balanceOf(bob)).toNumber();
    await this.masterFavor.getHonor(dev, {from: alice});
    await this.masterFavor.getHonor(dev, {from: bob});
    this.balance_alice_after_honor = (await this.favor.balanceOf(alice)).toNumber();
    this.balance_bob_after_honor = (await this.favor.balanceOf(bob)).toNumber();

    this.deposit_in_last_period = ((await this.masterFavor.favorCompanyInformation(dev, 0)).deposit_in_last_period).toNumber();

    if (Math.abs(this.deposit_in_last_period - this.pending_deposit_in_last_period) > 2){
      throw new Error(
                  `Incorrect deposit_in_last_period`
                  );
    }

    this.HonorAmount = pendingHonor(
                          this.balance_bob_befor_honor, 
                          this.balance_after_contribution - this.init_balance + this.paidReward, 
                          this.deposit_in_last_period
                        );


    if (Math.abs(this.HonorAmount - this.balance_bob_after_honor + this.balance_bob_befor_honor) > 2){
                throw new Error(
                  `Incorrect honor amount`
                );
    }

    this.HonorAmount = pendingHonor(
                          this.alice_honor, 
                          this.balance_after_contribution - this.init_balance + this.paidReward, 
                          this.deposit_in_last_period
                       );

    if (Math.abs(this.HonorAmount - this.balance_alice_after_honor + this.balance_alice_befor_honor + this.pendingRewardAlice) > 2){
                throw new Error(
                  `Incorrect honor amount`
                );
    }
  });

  it('commercial, raised funds, didnt refund', async () => {
    this.init_balance = (await this.favor.balanceOf(this.masterFavor.address)).toNumber();

    await this.masterFavor.addFavorWell(dev, 500000, 10, 767467456746, 999, {from: minter});
    await this.masterFavor.makeContribution(dev, {from: minter});

    this.balance_after_contribution = (await this.favor.balanceOf(this.masterFavor.address)).toNumber();
    this.paidReward = 0;
    this.deposit_in_last_period = 0;
    this.alice_honor = 0;
    
    await this.masterFavor.deposit(3, 10, true, {from: alice});

    this.init_time = (await time.latest()).toNumber();
    await time.increase(5);

    await this.masterFavor.deposit(5, 7, true, {from: alice});
    await this.masterFavor.deposit(3, 100, true, {from: bob});

    await time.increase(5300);

    await this.masterFavor.withdraw(5, 0, true, {from: alice});
    await this.masterFavor.withdraw(5, 7, true, {from: alice});
    await this.masterFavor.withdraw(3, 100, true, {from: bob});
    await this.masterFavor.withdraw(3, 10, true, {from: alice});

    await this.masterFavor.RefundHonor(dev, 1000, {from: minter});

    await time.increase(50);

    await this.masterFavor.RefundHonor(dev, 100, {from: minter});

    await time.increase(5000);

    this.balance_1_minter = (await this.favor.balanceOf(minter)).toString();
    await this.masterFavor.RefundHonor(dev, 100, {from: minter});
    this.balance_2_minter = (await this.favor.balanceOf(minter)).toString();
    assert.equal(this.balance_1_minter, this.balance_2_minter);

    this.paidReward = (await this.favor.balanceOf(alice)).toNumber() +
                      (await this.favor.balanceOf(bob)).toNumber();

    this.balance_alice_befor_honor = (await this.favor.balanceOf(alice)).toNumber();
    this.balance_bob_befor_honor = (await this.favor.balanceOf(bob)).toNumber();
    await this.masterFavor.getHonor(dev, {from: alice});
    await this.masterFavor.getHonor(dev, {from: bob});
    this.balance_alice_after_honor = (await this.favor.balanceOf(alice)).toNumber();
    this.balance_bob_after_honor = (await this.favor.balanceOf(bob)).toNumber();

    this.HonorAmount = pendingHonor(
                          this.balance_alice_befor_honor, 
                          1100,
                          this.paidReward
                       );

    assert.equal(
      this.balance_alice_after_honor - this.balance_alice_befor_honor, 
      this.HonorAmount
    );

    this.HonorAmount = pendingHonor(
                          this.balance_bob_befor_honor, 
                          1100,
                          this.paidReward
                       );

    assert.equal(
      this.balance_bob_after_honor - this.balance_bob_befor_honor, 
      this.HonorAmount
    );
  });

  it('comercial, raised funds, refund', async () => {
    this.init_balance = (await this.favor.balanceOf(this.masterFavor.address)).toNumber();

    await this.masterFavor.addFavorWell(dev, 500000, 10, 767467456746, 999, {from: minter});
    await this.masterFavor.makeContribution(dev, {from: minter});

    this.balance_after_contribution = (await this.favor.balanceOf(this.masterFavor.address)).toNumber();
    this.paidReward = 0;
    this.deposit_in_last_period = 0;
    this.alice_honor = 0;
    
    await this.masterFavor.deposit(3, 10, true, {from: alice});

    this.init_time = (await time.latest()).toNumber();
    await time.increase(5);

    await this.masterFavor.deposit(5, 7, true, {from: alice});
    await this.masterFavor.deposit(3, 100, true, {from: bob});

    await time.increase(5300);

    await this.masterFavor.withdraw(5, 0, true, {from: alice});
    await this.masterFavor.withdraw(5, 7, true, {from: alice});
    await this.masterFavor.withdraw(3, 100, true, {from: bob});
    await this.masterFavor.withdraw(3, 10, true, {from: alice});

    await this.masterFavor.RefundHonor(dev, 1000, {from: minter});

    await time.increase(5);

    await this.masterFavor.RefundHonor(dev, 5200000, {from: minter});

    this.paidReward = (await this.favor.balanceOf(alice)).toNumber() +
                      (await this.favor.balanceOf(bob)).toNumber();

    this.balance_alice_befor_honor = (await this.favor.balanceOf(alice)).toNumber();
    this.balance_bob_befor_honor = (await this.favor.balanceOf(bob)).toNumber();
    await this.masterFavor.getHonor(dev, {from: alice});
    await this.masterFavor.getHonor(dev, {from: bob});
    this.balance_alice_after_honor = (await this.favor.balanceOf(alice)).toNumber();
    this.balance_bob_after_honor = (await this.favor.balanceOf(bob)).toNumber();

    this.HonorAmount = pendingHonor(
                          this.balance_alice_befor_honor,
                          5200000 + 1000,
                          this.paidReward
                       );

    assert.equal(
      this.balance_alice_after_honor - this.balance_alice_befor_honor, 
      this.HonorAmount
    );

    this.HonorAmount = pendingHonor(
                          this.balance_bob_befor_honor,
                          5200000 + 1000,
                          this.paidReward
                       );

    assert.equal(this.balance_bob_after_honor - 
                 this.balance_bob_befor_honor, 
                 this.HonorAmount
    );
                 
  });
});


