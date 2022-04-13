// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol"; 
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol"; 
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";


interface AggregatorV3Interface {
    function latestRoundData()
    external
    view
    returns (
      uint80 roundId,
      uint256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    );
}


contract FGSExchangeV1Test is OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public token;
    AggregatorV3Interface public priceFeed;
    uint256 public tokenPrice; // 10 =>   0.1  USD    and   ( 0.01 USD = 1 )
    mapping(uint256 => uint256) public stakingPeriodsAPY;
    mapping(address => uint256[])  userStaked;
    mapping(address => uint256[])  userVested;
    uint256 public totalPurchases;

    struct Purchase {
        address User;
        uint256 investedamount;
        uint256 totalamount;
        uint256 purchasingTime;
        uint256 lockingPeriod;
        uint256 claimedAmount;
        uint256 nextreleaseTime;
        uint8 purchaseType; // 0 for staking   1 for vesting
        uint8 releasedpercentage;
        bool staus;
    }

    Purchase[] public purchases;
    
    event Staked(address indexed user, uint256 indexed pid, uint256 indexed stakedamount, uint256 rewardamnt);
    event Vested(address indexed user, uint256 indexed pid, uint256 indexed vestedamount, uint256 rewardamnt);

    function Initialize(AggregatorV3Interface _priceFeed, IERC20Upgradeable _token, uint _tokenprice) public initializer {
        __Ownable_init(); 
        stakingPeriodsAPY[12] = 1000;
        stakingPeriodsAPY[18] = 1500;
        stakingPeriodsAPY[24] = 2000;
        stakingPeriodsAPY[36] = 2750;
        stakingPeriodsAPY[48] = 3500;
        priceFeed = _priceFeed;
        token = _token;
        tokenPrice = _tokenprice;
    }


    function BuyAndStake(uint256 _lockingTimeinMonths) external payable {
        require(
            msg.value > getOneTokenPriceinWei(),
            "Please buy atleast one Token"
        );

        require(
            _lockingTimeinMonths == 12 ||
                _lockingTimeinMonths == 18 ||
                _lockingTimeinMonths == 24 ||
                _lockingTimeinMonths == 36 ||
                _lockingTimeinMonths >= 48,
            "Incorrect locking Period"
        );

        uint256 userAllocation = calculateAmount(msg.value);

        uint256 unstakeTime=0;

        if (_lockingTimeinMonths == 12) {
            unstakeTime = block.timestamp + 365 days;
        } else if (_lockingTimeinMonths == 18) {
            unstakeTime = block.timestamp + 548 days;
        } else if (_lockingTimeinMonths == 24) {
            unstakeTime = block.timestamp + 731 days;
        } else if (_lockingTimeinMonths == 36) {
            unstakeTime = block.timestamp + 1096 days;
        } else if (_lockingTimeinMonths >= 48) {
            unstakeTime = block.timestamp + 1461 days;
        } else {
            revert();
        }
        
        uint apy=0;
        if (_lockingTimeinMonths>48) {
           apy = stakingPeriodsAPY[48]; 
        } 
        else {
            apy = stakingPeriodsAPY[_lockingTimeinMonths];
        }

        uint256 aprAmount = (userAllocation *
            apy) / 10000;
        uint256 claimAmount = userAllocation + aprAmount;

        Purchase memory userpurchase = Purchase({
            User: msg.sender,
            investedamount: userAllocation,
            totalamount: claimAmount,
            purchasingTime: block.timestamp,
            lockingPeriod: _lockingTimeinMonths,
            claimedAmount: 0,
            nextreleaseTime: unstakeTime,
            purchaseType: 0,
            releasedpercentage: 0,
            staus: false
        });

        purchases.push(userpurchase);
        userStaked[msg.sender].push(totalPurchases);

        emit Staked(msg.sender, totalPurchases, userAllocation, aprAmount);
        totalPurchases++;
    }

    
       function Stake(uint256 _amount,uint256 _lockingTimeinMonths) external {
        require(
            _amount >= 1 ether,
            "Please Stake atleast one Token"
        );

        require(
            _lockingTimeinMonths == 12 ||
                _lockingTimeinMonths == 18 ||
                _lockingTimeinMonths == 24 ||
                _lockingTimeinMonths == 36 ||
                _lockingTimeinMonths >= 48,
            "Incorrect locking Period"
        );

        uint256 unstakeTime=0;

        if (_lockingTimeinMonths == 12) {
            unstakeTime = block.timestamp + 365 days;
        } else if (_lockingTimeinMonths == 18) {
            unstakeTime = block.timestamp + 548 days;
        } else if (_lockingTimeinMonths == 24) {
            unstakeTime = block.timestamp + 731 days;
        } else if (_lockingTimeinMonths == 36) {
            unstakeTime = block.timestamp + 1096 days;
        } else if (_lockingTimeinMonths >= 48) {
            unstakeTime = block.timestamp + 1461 days;
        } else {
            revert();
        }
       
        uint apy=0;
        if (_lockingTimeinMonths>48) {
           apy = stakingPeriodsAPY[48]; 
        } 
        else {
            apy = stakingPeriodsAPY[_lockingTimeinMonths];
        }
        uint256 aprAmount = (_amount *
            apy) / 10000;
        uint256 claimAmount = _amount + aprAmount;

        Purchase memory userpurchase = Purchase({
            User: msg.sender,
            investedamount: _amount,
            totalamount: claimAmount,
            purchasingTime: block.timestamp,
            lockingPeriod: _lockingTimeinMonths,
            claimedAmount: 0,
            nextreleaseTime: unstakeTime,
            purchaseType: 0,
            releasedpercentage: 0,
            staus: false
        });

        purchases.push(userpurchase);
        userStaked[msg.sender].push(totalPurchases);

        emit Staked(msg.sender, totalPurchases, _amount, aprAmount);
        totalPurchases++;

        token.safeTransferFrom(msg.sender, address(this), _amount);
    }



    function BuyAndVesting() external payable {
        require(
            msg.value > getOneTokenPriceinWei(),
            "Please buy atleast one Token"
        );

        uint256 userAllocation = calculateAmount(msg.value);

        uint256 bonusAmount=0;

        if (msg.value > 0.1 ether && msg.value < 0.9 ether) {
            uint256 bonususdamnt = convertUSDtoWei(12);
            bonusAmount = calculateAmount(bonususdamnt);
        } else if (msg.value > 0.9 ether && msg.value < 4 ether) {
            uint256 bonususdamnt = convertUSDtoWei(10);
            bonusAmount = calculateAmount(bonususdamnt);
        } else if (msg.value > 4 ether) {
            uint256 checkupperlimit = convertUSDtoWei(1500000);
            require(msg.value < checkupperlimit);
            uint256 bonususdamnt = convertUSDtoWei(8);
            bonusAmount = calculateAmount(bonususdamnt);
        }

        uint256 totalamnt = bonusAmount + (userAllocation);
        uint256 upfrontAmount = (totalamnt * 25) / 100;
        uint nexttime = block.timestamp + 7890000;

        Purchase memory userpurchase = Purchase({
            User: msg.sender,
            investedamount: userAllocation,
            totalamount: totalamnt,
            purchasingTime: block.timestamp,
            lockingPeriod: 0,
            claimedAmount: upfrontAmount,
            nextreleaseTime: nexttime,
            purchaseType: 1,
            releasedpercentage: 25,
            staus: false
        });

        purchases.push(userpurchase);
        userVested[msg.sender].push(totalPurchases);
        emit Vested(msg.sender, totalPurchases, userAllocation, bonusAmount);
       
        totalPurchases++;
        token.safeTransfer(msg.sender, upfrontAmount);
    }


    function claim(uint256 _id) external {
        require(_id < totalPurchases, "Invalid Purchase Id");
        Purchase memory pd = purchases[_id];
        require(!(pd.User != msg.sender), "Caller is not the buyer");
        require(!pd.staus, "Already claimd all tokens");

        if (pd.purchaseType != 0) {
            claimVesting(_id); 
        } else {
            claimStake(_id);
        }
    }


    function claimStake(uint256 _id) internal {
        Purchase storage pd = purchases[_id];
        require(pd.nextreleaseTime < block.timestamp, "Claim time not reached");

        uint256 claimamnt = pd.totalamount;

        require(
            claimamnt <= token.balanceOf(address(this)),
            "Insufficient balance in Contract"
        );

        pd.staus = true;
        pd.claimedAmount = claimamnt;
        token.safeTransfer(msg.sender, claimamnt);
    }


    function claimVesting(uint256 _id) internal {
        Purchase storage pd = purchases[_id];

        uint256 timeDiff = (block.timestamp - pd.purchasingTime);

        if (timeDiff > 7890000 && timeDiff <= 15780000) {
            require(
                pd.releasedpercentage == 25,
                "First Vesting: You can withdraw only once"
            );

            uint256 amnt = ((pd.totalamount * 25) / 100);

            pd.claimedAmount += amnt;
            pd.releasedpercentage = 50;
            pd.nextreleaseTime = pd.purchasingTime + 15780000;  
            token.safeTransfer(msg.sender, amnt);

        } else if (timeDiff > 15780000 && timeDiff <= 23670000) {
            require(
                pd.releasedpercentage <= 50,
                "Second Vesting: You can withdraw only once"
            );

            uint256 amnt;
            if (pd.releasedpercentage == 25) {
                amnt = ((pd.totalamount * 50) / 100);
            } else {
                amnt = ((pd.totalamount * 25) / 100);
            }

            pd.claimedAmount += amnt;
            pd.releasedpercentage = 75;
            pd.nextreleaseTime = pd.purchasingTime + 23670000;  
            token.safeTransfer(msg.sender, amnt);

        } else if (timeDiff > 23670000) {
            require(pd.releasedpercentage <= 75, "You can withdraw only once");

            uint256 amnt = pd.totalamount - pd.claimedAmount;
            require(amnt > 0, "no amnt to claim");

            pd.claimedAmount = pd.totalamount;
            pd.releasedpercentage = 100;
            pd.staus = true;
            token.safeTransfer(msg.sender, amnt);
        } else {
            revert("UnlockTime not Reached");
        }
    }


    function manualVestingEntryOwner(Purchase[] calldata _oldusers) external onlyOwner {

        for (uint i =0; i < _oldusers.length; i++) { 

              purchases.push(_oldusers[i]);
              userVested[_oldusers[i].User].push(totalPurchases);  
              totalPurchases++;
        }   
    }


    function withdrawFunds(uint256 amount) external onlyOwner {
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed.");
    }

    function withdrawTokens(address _useradd, uint256 amount) external onlyOwner {
        require(token.balanceOf(address(this)) > amount, "Insufficient Balance");
        token.safeTransfer(_useradd, amount);
    }

    // Helper Functions 
    function trackUserWithID(uint256 _id) public view returns (address) {
        require(_id < totalPurchases, "Invalid Purchase Id");

        Purchase memory pd = purchases[_id];
        return pd.User;
    }


    function getPurchaseDetail(uint256 _id)
        public
        view
        returns (Purchase memory)
    {
        require(_id < totalPurchases, "Invalid Purchase Id");
        Purchase memory pd = purchases[_id];
        return pd;
    }


    function getUserStakedPurchase(address _user)
        public
        view
        returns (uint256[] memory)
    {
        return userStaked[_user];
    }


    function getUserVestedPurchase(address _user)
        public
        view
        returns (uint256[] memory)
    {
        return userVested[_user];
    }


    function getOneCentsinWei() public view returns (uint256) {
        return (1 ether / priceBNBUSD());
    }


    function convertTokenPricetoCents() public view returns (uint256) {
        return ((tokenPrice * 10**8) / 100);
    }

    function getOneTokenPriceinWei() public view returns (uint256) {
        return (convertTokenPricetoCents() * getOneCentsinWei());
    }


    function calculateAmount(uint256 _buyamount) public view returns (uint256) {
        return (_buyamount * 1 ether) / getOneTokenPriceinWei();
    }


    function changeTokenPrice(uint256 _tp) external onlyOwner{
        tokenPrice = _tp;
    }
    

   function priceBNBUSD() public view returns(uint) {
        //   ( ,uint price,,,  ) = priceFeed.latestRoundData();
        uint price = 40000000000;
        return price;
    }


    function convertUSDtoWei(uint256 _amnt) public view returns (uint256) {
        uint256 usdtocents = ((_amnt * 10**8) / 100);
        uint256 usdTowei = getOneCentsinWei() * usdtocents;
        return usdTowei;
    }

    function changeStakingAPR(uint256 _lockingTimeinMonths, uint256 _newApy) external onlyOwner {

        require(
            _lockingTimeinMonths == 12 ||
                _lockingTimeinMonths == 18 ||
                _lockingTimeinMonths == 24 ||
                _lockingTimeinMonths == 36 ||
                _lockingTimeinMonths == 48,
            "Incorrect locking Period"
        );  

        stakingPeriodsAPY[_lockingTimeinMonths] = _newApy;
    }  

    function updateAggregatorV3Interface(AggregatorV3Interface _newfeed) external onlyOwner {
        priceFeed = _newfeed;
    }

}





