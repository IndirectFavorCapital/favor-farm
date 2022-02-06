pragma solidity 0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IFarm.sol";
import "./interfaces/IRouter.sol";
import "./interfaces/IFarmRouter.sol";
import "./FarmRouter.sol";


// MasterChef is the master of Favor. He can make Favor and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once Favor is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract MasterFavor is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant MAX_UINT = 2**256 - 1;

    // Info of each user.
    struct UserInfo {
        uint amount;         // How many LP tokens the user has provided.
        //uint256 rewardDebt;  // Reward debt. 
        uint lastRewardTime;
    }

    struct FavorCompanyInformation {
        uint totalAmount;                //desired amount
        uint contribution_percantage;    //contribution amount
        uint start_time;                 //farm start
        uint period_of_life;             //period of farm's life
        uint refund_period;              //time for refund 
        bool farm_close;                 //farm close. Can't deposit or refund amount
        uint refund_amount;              //amount that company refund
        uint deposit_in_last_period;     //all investors deposit in last period
        bool start;                      //farm start(can deposit)
        uint stop_time;                  //farm stop. Can't deposit
        uint balanceInFavor;             //balance in favor
        uint balanceInBUSD;              //balance in BUSD
        uint lastRewardTime;
        uint[] CampaingPools;            //numbers of farm's pools
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;                                         // Address of LP token contract.
        address favorCompanyOwner;                              // Address of company owner
        uint256 pancakeswapPid;                                 // Pancakeswap farm pool id
        uint256 allocPoint;                                     // How many allocation points assigned to this pool. Favors to distribute per second.
        bool onPancakeswap;                                     //is it on Pancakeswap ?
        uint amount;                                            //total amount of LP token in the pool
        uint pendingReward;                                     //total reward debt in the pool
    }

    struct LP_token{
        address LP_token_address;   //address of LP token
        uint pancakeSwapPoolId;     //pool's number on PancakeSwap
        bool onPancakeswap;         //is it on Pancakeswap ?
    }

    struct User {
        mapping(address => mapping(uint => HonorInfo)) honors; //address farm owner -> information about honor
        address rout_contract;                                 //rout contract for Pancakeswap
    }    

    //information about honor
    struct HonorInfo{
        uint honor;    //amount of honor
        bool getHonor; //is user get honor
    }

    // The Favor TOKEN!
    IERC20 public favor;
    // The BUSD token
    IERC20 public BUSD;
    // The BNB token
    IERC20 public BNB;
    // The cake token
    IERC20 public cake;
    //tokens in the farm
    LP_token[] public LP_tokens_for_farm; 
    //iteract with pancakeSwap for swap tokens
    IPancakeRouter public PancakeRouter; 
    // The FAVOR-BUSD LP pool
    address public favor_BUSD_LP_pool;
    // The FAVOR-CAKE LP pool
    address public cake_favor_LP_pool;
    // The dev address
    address public devaddr;
    // Favor tokens created per block.
    uint256 public favorPerTime;
    // Bonus muliplier for early favor makers.
    uint256 public BONUS_MULTIPLIER = 1;
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // Info of user's honors and rout contracts
    mapping(address => User) public users;
    //Info about each farms
    mapping (address => FavorCompanyInformation[]) public favorCompanyInformation;
    // Pancakeswap farm smart contract
    IFarm public pancakeswapFarm;
    //Farm of routs contract for pancakeswap
    IFarmRouter public FarmRouter;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor( 
        IERC20 _favor,
        IERC20 _BUSD,
        IPancakeRouter _PancakeRouter,
        address _favor_BUSD_LP_pool,
        address _cake_favor_LP_pool,
        address _devaddr,
        IFarm _pancakeswapFarm,
        IERC20 _cake,
        uint256 _favorPerTime,
        IFarmRouter _FarmRouter
    ) public {
        favor = _favor;
        BUSD = _BUSD;
        favor_BUSD_LP_pool = _favor_BUSD_LP_pool;
        cake_favor_LP_pool = _cake_favor_LP_pool;
        PancakeRouter = _PancakeRouter;
        devaddr = _devaddr;
        pancakeswapFarm = _pancakeswapFarm;
        cake = _cake;
        favorPerTime = _favorPerTime;
        FarmRouter = _FarmRouter;
    }

    //add token for use in farms
    function add_LP_token(address _LP_token) public onlyOwner{
        uint pancakeswapPid;
        bool _onPancakeswap;
        uint pid_index;
        uint pool_length = pancakeswapFarm.poolLength();
        //check token on PancakeSwap
        for (pid_index = 0; pid_index < pool_length; pid_index++){          
            if (address(pancakeswapFarm.poolInfo(pid_index).lpToken) == _LP_token){  
                pancakeswapPid = pid_index;
                _onPancakeswap = true;
                break; 
            } 
        }
        LP_tokens_for_farm.push(LP_token({
                                LP_token_address: _LP_token,
                                pancakeSwapPoolId: pancakeswapPid,
                                onPancakeswap: _onPancakeswap
            })); 
    }

    //function that add farm
    function addFavorWell(address _FavorCompanyOwner, uint _totalAmount, uint _contribution_percantage, uint _period_of_life, uint _refund_period) public onlyOwner{
        favorCompanyInformation[_FavorCompanyOwner].push();
        uint farms_amount = favorCompanyInformation[_FavorCompanyOwner].length;
        FavorCompanyInformation storage FCI = favorCompanyInformation[_FavorCompanyOwner][farms_amount.sub(1)];
        FCI.totalAmount = _totalAmount;
        FCI.contribution_percantage = _contribution_percantage;
        FCI.period_of_life = _period_of_life;
        FCI.refund_period = _refund_period;
        //contribution_percantage = 1 for non-commercial. fee free
        uint allocationPoint;
        if (_contribution_percantage == 1 || _contribution_percantage == 10){
            FCI.start = true;
            allocationPoint = 21;
        } else if (_contribution_percantage == 30){
            allocationPoint = 22;
        } else if (_contribution_percantage == 50){
            allocationPoint = 23;
        }
        for (uint i = 0; i < LP_tokens_for_farm.length; i++){
            add(allocationPoint, IERC20(LP_tokens_for_farm[i].LP_token_address), _FavorCompanyOwner, LP_tokens_for_farm[i].pancakeSwapPoolId, LP_tokens_for_farm[i].onPancakeswap);
        }
    }

    //make contribution and fee
    function makeContribution(address _FavorCompanyOwner) public {
        uint contribution;
        uint fee;
        uint farms_amount = favorCompanyInformation[_FavorCompanyOwner].length;
        FavorCompanyInformation storage FCI = favorCompanyInformation[_FavorCompanyOwner][farms_amount.sub(1)];

        require(FCI.contribution_percantage != 1, 'it is non profit project!');
        contribution = FCI.totalAmount.mul(FCI.contribution_percantage).div(100);
        fee = FCI.totalAmount.mul(5).div(100);
        BUSD.transferFrom(msg.sender, address(this), contribution + fee);
        FCI.balanceInBUSD = contribution;
        FCI.balanceInFavor = _swapTokens(contribution, address(BUSD), address(favor), address(this));
        FCI.start = true;
    }

    function _swapTokens(uint amount, address token_0, address token_1, address to) private returns(uint){
        address[] memory path = new address[](2);
        path[0] = address(token_0);
        path[1] = address(token_1);
        IERC20(token_0).approve(address(PancakeRouter), amount);
        uint[] memory balances;
        balances = IPancakeRouter(PancakeRouter).swapExactTokensForTokens(amount, 0, path, to, block.timestamp);
        return balances[1];
    }

    // Add a new lp to the pool. Can only be called by the owner.
    function add(uint256 _allocPoint, IERC20 _lpToken, address _favorCompanyOwner, uint256 _pancakeswapPid, bool _onPancakeswap) public {
        //uint256 lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            favorCompanyOwner: _favorCompanyOwner,
            pancakeswapPid: _pancakeswapPid,
            allocPoint: _allocPoint,
            onPancakeswap: _onPancakeswap,
            amount:0,
            pendingReward:0
        }));
        uint farms_amount = favorCompanyInformation[_favorCompanyOwner].length;
        favorCompanyInformation[_favorCompanyOwner][farms_amount.sub(1)].CampaingPools.push(poolInfo.length.sub(1));
    }

    // Update the given pool's Favor allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // Return reward multiplier over the given _from to _to time.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        uint256 multiplier;
        if (_to > _from){
            multiplier = (_to.sub(_from)).mul(BONUS_MULTIPLIER);
        }
        return multiplier;
    }

    // View function to see pending Favors on frontend.
    function pendingFavor(uint256 _pid, address _user) public view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint farms_amount = favorCompanyInformation[pool.favorCompanyOwner].length;
        FavorCompanyInformation storage FCI = favorCompanyInformation[pool.favorCompanyOwner][farms_amount.sub(1)];
        uint256 lpSupply = pool.amount;
        uint256 multiplier;
        uint rewardFromPancakeswap;
        if (pool.onPancakeswap == true){
            rewardFromPancakeswap = getAmountOut(pancakeswapFarm.pendingCake(pool.pancakeswapPid, users[_user].rout_contract), address(cake) ,address(favor));
        }
        if (block.timestamp > user.lastRewardTime && lpSupply != 0 && FCI.start_time != 0) {
            uint stop_time = FCI.start_time + FCI.period_of_life;
            uint256 toTime = block.timestamp < stop_time ? block.timestamp : stop_time;
            multiplier = getMultiplier(user.lastRewardTime, toTime);
        }
        uint user_amount = user.amount;
        uint reward = user_amount.mul(multiplier).mul(favorPerTime).mul(pool.allocPoint).div(lpSupply).div(20) + rewardFromPancakeswap.div(2);
        return reward;
    }

    //see pending of all users in all pools in the farm
    function pendingFavorForAllPools(FavorCompanyInformation memory FCI, uint reward_time) public view returns (uint256){
        uint reward;
        for (uint _pid = 0; _pid<FCI.CampaingPools.length; _pid++){
            PoolInfo storage pool = poolInfo[FCI.CampaingPools[_pid]];
            uint lpSupply = pool.amount;
            if (lpSupply != 0 && FCI.start_time != 0) {
                uint pool_reward = (reward_time.mul(favorPerTime).mul(pool.allocPoint).sub(pool.pendingReward.mul(favorPerTime).mul(pool.allocPoint).div(lpSupply))).div(20);
                reward = reward.add(pool_reward);
            }
        }
        return reward;
    }

    function _check_farm_state (FavorCompanyInformation storage FCI, address _favorCompanyOwner, uint _favorFromPancakeswap) private{
        uint reward_time;
        if (FCI.start != false && FCI.start_time != 0){
            uint max_time = FCI.start_time + FCI.period_of_life;
            if (max_time <= block.timestamp){
                FCI.start = false;
                FCI.stop_time = block.timestamp; 
                reward_time = max_time;
            } else {
                reward_time = block.timestamp;
            }
            FCI.lastRewardTime = reward_time;
            uint balanceInBUSD_plus_Reward;
            uint balanceInFavor_plus_Reward;
            uint reward;
            uint favorFromPancakeswap = _favorFromPancakeswap;
            reward = pendingFavorForAllPools(FCI, reward_time);
            balanceInFavor_plus_Reward = FCI.balanceInFavor.add(reward + favorFromPancakeswap);
            balanceInBUSD_plus_Reward = getAmountOut(balanceInFavor_plus_Reward, address(favor), address(BUSD));
            uint fee;

            if (FCI.contribution_percantage == 1){
                fee = FCI.totalAmount.mul(5).div(100);
            }
            if (balanceInBUSD_plus_Reward >= FCI.totalAmount + fee){
                if (FCI.start != false){
                    FCI.start = false;
                    FCI.stop_time = block.timestamp ;
                }
                uint totalAmountInFavor = getAmountOut(FCI.totalAmount, address(BUSD), address(favor));
                favor.transfer(_favorCompanyOwner, totalAmountInFavor);
                FCI.balanceInFavor = totalAmountInFavor;
                FCI.balanceInBUSD = FCI.totalAmount;
                FCI.deposit_in_last_period = FCI.deposit_in_last_period.add(reward);
                if (FCI.contribution_percantage == 1){
                    FCI.farm_close = true;
                }
                FCI.refund_amount = 0;
            } else if (FCI.start == false){
                FCI.refund_amount = balanceInFavor_plus_Reward;
                FCI.deposit_in_last_period = FCI.deposit_in_last_period.add(reward);
                if (FCI.contribution_percantage == 1){
                    favor.transfer(_favorCompanyOwner, balanceInFavor_plus_Reward);
                }
                FCI.farm_close = true;
            }
        }
    }

    // Deposit LP tokens to MasterFavor for Favor allocation.
    function deposit(uint256 _pid, uint256 _amount, bool _on) public {
        PoolInfo storage pool = poolInfo[_pid];
        uint farms_amount = favorCompanyInformation[pool.favorCompanyOwner].length;
        FavorCompanyInformation storage FCI = favorCompanyInformation[pool.favorCompanyOwner][farms_amount.sub(1)];

        require(FCI.start == true, "Farm doesn't work");

        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);

        uint favorFromPancakeswap;
        if (pool.onPancakeswap == true && _on == true){
           favorFromPancakeswap = _depositOnPancakeswap(pool.pancakeswapPid, _amount, pool.lpToken, msg.sender).div(2);   
        }

        _check_farm_state(FCI, pool.favorCompanyOwner, favorFromPancakeswap);
        
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 pending;
        uint lpSupply = pool.amount;

        if (user.amount > 0) {
            uint multiplier;
            if (block.timestamp > user.lastRewardTime && lpSupply != 0 && FCI.start_time != 0) {
                multiplier = getMultiplier(user.lastRewardTime, FCI.lastRewardTime);
            }
            
            uint user_amount = user.amount;
            uint reward = user_amount.mul(multiplier).mul(favorPerTime).mul(pool.allocPoint).div(lpSupply).div(20);

            pending = reward + favorFromPancakeswap;

            if(pending > 0) {
                favorTransfer(msg.sender, pending);
                if (FCI.start == true){
                    FCI.balanceInFavor = FCI.balanceInFavor.add(pending);
                    FCI.deposit_in_last_period = FCI.deposit_in_last_period.add(pending);
                    users[msg.sender].honors[pool.favorCompanyOwner][farms_amount.sub(1)].honor = users[msg.sender].honors[pool.favorCompanyOwner][farms_amount.sub(1)].honor.add(pending);
                } else {
                    users[msg.sender].honors[pool.favorCompanyOwner][farms_amount.sub(1)].honor = users[msg.sender].honors[pool.favorCompanyOwner][farms_amount.sub(1)].honor.add(reward);
                }
            }
            FCI.balanceInBUSD = getAmountOut(FCI.balanceInFavor, address(favor), address(BUSD));
        }

        if (lpSupply > 0){
            pool.pendingReward = pool.pendingReward.sub(user.amount.mul(user.lastRewardTime));
        }
        if (_amount > 0) {
            if (FCI.start_time == 0){
                FCI.start_time = block.timestamp;
            }
            user.amount = user.amount.add(_amount);
            if (FCI.start == true){
                pool.amount = pool.amount.add(_amount);
            }
        }

        user.lastRewardTime = block.timestamp;
        pool.pendingReward = pool.pendingReward.add(user.amount.mul(user.lastRewardTime));

        emit Deposit(msg.sender, _pid, _amount);
    }

    function getAmountOut(uint amount, address token_0, address token_1) public view returns (uint){
        address[] memory path = new address[](2);

        path[0] = token_0;
        path[1] = token_1;

        return IPancakeRouter(PancakeRouter).getAmountsOut(amount, path)[1];
    }

    function _checkRouter(address user_address) private returns (address) {
        address rout;
        if (users[user_address].rout_contract == address(0)){
            rout = FarmRouter.create_router_contract(address(this), address(PancakeRouter), address(pancakeswapFarm), 
                                                     address(favor), address(cake), cake_favor_LP_pool);
            users[user_address].rout_contract = address(rout);
        } else {
            rout = users[user_address].rout_contract;
        }
        return rout;
    }

    function _depositOnPancakeswap(uint _pid, uint _amount, IERC20 _token, address _user) private returns(uint){
        address rout = _checkRouter(_user);

        _token.safeTransfer(address(rout), _amount);
        return IRouter(rout).deposit(_pid, _amount);
    }

    function _withdrawFromPancakeswap(uint _pid, uint _amount) private returns(uint){
        address rout = _checkRouter(msg.sender);

        return IRouter(rout).withdraw(_pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint _pid, uint _amount, bool _on) public {
        PoolInfo storage pool = poolInfo[_pid];
        uint favorFromPancakeswap;

        if (pool.onPancakeswap == true && _on == true){
            favorFromPancakeswap = _withdrawFromPancakeswap(pool.pancakeswapPid, _amount).div(2);        
        }

        uint farms_amount = favorCompanyInformation[pool.favorCompanyOwner].length;
        FavorCompanyInformation storage FCI = favorCompanyInformation[pool.favorCompanyOwner][farms_amount.sub(1)];

        _check_farm_state(FCI, pool.favorCompanyOwner, favorFromPancakeswap);

        address msg_sender = msg.sender;
        UserInfo storage user = userInfo[_pid][msg_sender];
        require(user.amount >= _amount, "withdraw: not good");
        uint pending;
        uint multiplier;
        uint lpSupply = pool.amount;

        if (block.timestamp > user.lastRewardTime && FCI.start_time != 0) {
            multiplier = getMultiplier(user.lastRewardTime, FCI.lastRewardTime);
        }

        uint user_amount = user.amount;
        uint reward = user_amount.mul(multiplier).mul(favorPerTime).mul(pool.allocPoint).div(lpSupply).div(20);
        pending = reward + favorFromPancakeswap;

        if(pending > 0) {
            favorTransfer(msg_sender, pending);
        }

        pool.pendingReward = pool.pendingReward.sub(user.amount.mul(user.lastRewardTime));
        
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            if (FCI.start == true){
                pool.amount = pool.amount.sub(_amount);
            } 
            pool.lpToken.safeTransfer(address(msg_sender), _amount);    
        }
        
        user.lastRewardTime = block.timestamp;
        pool.pendingReward = pool.pendingReward.add(user.amount.mul(user.lastRewardTime));
        users[msg_sender].honors[pool.favorCompanyOwner][farms_amount.sub(1)].honor = users[msg_sender].honors[pool.favorCompanyOwner][farms_amount.sub(1)].honor.add(pending);

        if (FCI.start == true){
                FCI.deposit_in_last_period = FCI.deposit_in_last_period.add(pending);
                uint user_amount_in_farm;
                uint amount_of_pools = FCI.CampaingPools.length;
                for (uint i = 0; i < amount_of_pools; i++){
                    user_amount_in_farm = user_amount_in_farm.add(user.amount);
                }         
                if (user_amount_in_farm == 0){
                    FCI.deposit_in_last_period = FCI.deposit_in_last_period.sub(users[msg_sender].honors[pool.favorCompanyOwner][farms_amount.sub(1)].honor);
                    users[msg_sender].honors[pool.favorCompanyOwner][farms_amount.sub(1)].honor = 0;
                }      
        } else {
                users[msg_sender].honors[pool.favorCompanyOwner][farms_amount.sub(1)].honor = users[msg_sender].honors[pool.favorCompanyOwner][farms_amount.sub(1)].honor.add(reward - favorFromPancakeswap);
        }
    
        FCI.balanceInFavor = FCI.balanceInFavor.add(pending);
        FCI.balanceInBUSD = getAmountOut(FCI.balanceInFavor, address(favor), address(BUSD));
       
        emit Withdraw(msg.sender, _pid, _amount);
    }

    //refund honor. It is for farms
    function RefundHonor(address _favorCompanyInformation, uint _amount) public {
        uint farms_amount = favorCompanyInformation[_favorCompanyInformation].length;
        FavorCompanyInformation storage FCI = favorCompanyInformation[_favorCompanyInformation][farms_amount.sub(1)];
        require(FCI.start == false, "Farm is working yet");
        require(FCI.farm_close == false, "Farm closed");
        require(FCI.start_time != 0, "Farm does not working");
        require(FCI.contribution_percantage != 1, "it is non profit project");

        if (FCI.stop_time + FCI.refund_period <= block.timestamp){
            FCI.farm_close = true;
        } else {
            uint fee = FCI.balanceInFavor.mul(5).div(100); 
            uint honor_amount = FCI.balanceInFavor;
            favor.transferFrom(msg.sender, address(this), _amount);
            FCI.refund_amount = FCI.refund_amount.add(_amount);
            if (honor_amount + fee <= FCI.refund_amount){
                FCI.farm_close = true;
            }
        }
    }

    //get honor. It is for users
    function getHonor(address _favorCompanyInformation) public {
        uint farms_amount = favorCompanyInformation[_favorCompanyInformation].length;
        FavorCompanyInformation storage FCI = favorCompanyInformation[_favorCompanyInformation][farms_amount.sub(1)];

        require(FCI.start == false, "Farm is working yet");
        require(FCI.farm_close == true, "Farm doesn't refund favor yet");
        require(users[msg.sender].honors[_favorCompanyInformation][farms_amount.sub(1)].getHonor == false, "You already get honor");
        
        HonorInfo storage Honor = users[msg.sender].honors[_favorCompanyInformation][farms_amount.sub(1)];
        for (uint pid = 0; pid < FCI.CampaingPools.length; pid++){   
            uint _pid = FCI.CampaingPools[pid];
            UserInfo storage user = userInfo[_pid][msg.sender];
            uint favorFromPancakeswap;
            PoolInfo storage pool = poolInfo[_pid];
            uint _amount = user.amount;
            if (pool.onPancakeswap == true){
                favorFromPancakeswap = _withdrawFromPancakeswap(pool.pancakeswapPid, _amount).div(2);        
            }
            uint pending;
            uint multiplier;
            uint lpSupply = pool.amount;
            if (block.timestamp > user.lastRewardTime && lpSupply != 0 && FCI.start_time != 0) {
                multiplier = getMultiplier(user.lastRewardTime, FCI.lastRewardTime);
            }
            if (lpSupply != 0){
                pending = _amount.mul(multiplier).mul(favorPerTime).mul(pool.allocPoint).div(lpSupply).div(20);
                pending = pending + favorFromPancakeswap;
            }
            if(pending > 0) {
                favorTransfer(msg.sender, pending);
            }
            if(_amount > 0) {
                user.amount = user.amount.sub(_amount);
                pool.lpToken.safeTransfer(address(msg.sender), _amount);    
            }
            Honor.honor = Honor.honor.add(pending);              
        }
        favor.transfer(msg.sender, Honor.honor.mul(FCI.refund_amount).div(FCI.deposit_in_last_period));
        Honor.getHonor = true;
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pancakeswapFarm.withdraw(pool.pancakeswapPid, user.amount);
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        //user.rewardDebt = 0;
    }
    
    // Favor transfer function
    function favorTransfer(address _to, uint256 _amount) internal {
        uint256 favorBal = favor.balanceOf(address(this));
        require(favorBal >= _amount, "not enough favor in smart contract");
        favor.transfer(_to, _amount);
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) public {
        require(msg.sender == devaddr, "dev: wut?");
        devaddr = _devaddr;
    }

    // Withdraw favor reward from samrt contract to dev
    function favorWithdraw() public onlyOwner {
        uint256 favorBal = favor.balanceOf(address(this));
        favor.transfer(devaddr, favorBal);
    }

    // Withdraw favor reward from samrt contract to dev
    function BUSDWithdraw() public onlyOwner {
        uint256 BUSDBal = BUSD.balanceOf(address(this));
        BUSD.transfer(devaddr, BUSDBal);
    }
}