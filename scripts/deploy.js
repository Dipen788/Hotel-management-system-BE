const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🏨 Deploying HotelBooking Smart Contract...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy HotelBooking
  const HotelBooking = await hre.ethers.getContractFactory("HotelBooking");
  const hotelBooking = await HotelBooking.deploy();
  await hotelBooking.waitForDeployment();

  const contractAddress = await hotelBooking.getAddress();
  console.log("✅ HotelBooking deployed to:", contractAddress);
  console.log("   Owner:", deployer.address);

  // ── Seed initial rooms ──
  console.log("\n📦 Seeding initial rooms...");

  const seedRooms = [
    {
      name: "Ocean View Standard",
      category: "Standard",
      price: hre.ethers.parseEther("0.01"),
      image: "QmStandardRoom1",
    },
    {
      name: "Garden Deluxe Suite",
      category: "Deluxe",
      price: hre.ethers.parseEther("0.025"),
      image: "QmDeluxeRoom1",
    },
    {
      name: "Penthouse Royal Suite",
      category: "Suite",
      price: hre.ethers.parseEther("0.05"),
      image: "QmSuiteRoom1",
    },
    {
      name: "City View Standard",
      category: "Standard",
      price: hre.ethers.parseEther("0.012"),
      image: "QmStandardRoom2",
    },
    {
      name: "Lakeside Deluxe",
      category: "Deluxe",
      price: hre.ethers.parseEther("0.03"),
      image: "QmDeluxeRoom2",
    },
  ];

  for (const room of seedRooms) {
    const tx = await hotelBooking.createRoom(
      room.name,
      room.category,
      room.price,
      room.image
    );
    await tx.wait();
    console.log(`   ✅ Created room: ${room.name}`);
  }

  const stats = await hotelBooking.getStats();
  console.log(`\n📊 Deployment Stats:`);
  console.log(`   Total Rooms: ${stats.totalRooms}`);
  console.log(`   Available Rooms: ${stats.availableRooms}`);

  // ── Export contract data for frontend ──
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "HotelBooking.sol",
    "HotelBooking.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const contractData = {
    address: contractAddress,
    abi: artifact.abi,
    network: hre.network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  // Write to frontend utils
  const frontendDir = path.join(__dirname, "..", "frontend", "src", "utils");
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(frontendDir, "contractData.json"),
    JSON.stringify(contractData, null, 2)
  );

  console.log(
    "\n📁 Contract data exported to frontend/src/utils/contractData.json"
  );
  console.log("\n🎉 Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
