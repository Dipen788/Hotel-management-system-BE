const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🏨 Deploying HotelBooking Smart Contract...\n");

  const [deployer, guest1, guest2] = await hre.ethers.getSigners();
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

  // ── Seed sample booking + review to demonstrate features ──
  console.log("\n📝 Seeding sample booking & review...");

  const now = Math.floor(Date.now() / 1000);
  const checkIn = now + 86400;
  const checkOut = now + 86400 * 3;
  const totalCost = hre.ethers.parseEther("0.02"); // 2 nights × 0.01

  // Guest1 books room 1
  const bookTx = await hotelBooking
    .connect(guest1)
    .bookRoom(1, checkIn, checkOut, { value: totalCost });
  await bookTx.wait();
  console.log("   ✅ Guest1 booked Room 1 (2 nights)");

  // Owner checks in and checks out guest1
  await (await hotelBooking.checkIn(1)).wait();
  console.log("   ✅ Guest1 checked in");
  await (await hotelBooking.checkOut(1)).wait();
  console.log("   ✅ Guest1 checked out");

  // Guest1 leaves a review
  await (
    await hotelBooking
      .connect(guest1)
      .submitReview(1, 5, "Amazing ocean view! Room was spotless and the staff were incredibly helpful. Will definitely come back!")
  ).wait();
  console.log("   ✅ Guest1 left a 5-star review");

  // Guest2 books room 2 (stays active for demo)
  const bookTx2 = await hotelBooking
    .connect(guest2)
    .bookRoom(2, checkIn, checkOut, { value: hre.ethers.parseEther("0.05") });
  await bookTx2.wait();
  console.log("   ✅ Guest2 booked Room 2 (active booking)");

  // ── Print stats ──
  const stats = await hotelBooking.getStats();
  console.log(`\n📊 Deployment Stats:`);
  console.log(`   Total Rooms: ${stats.totalRooms}`);
  console.log(`   Available Rooms: ${stats.availableRooms}`);
  console.log(`   Booked Rooms: ${stats.bookedRooms}`);
  console.log(`   Total Bookings: ${stats.totalBookings}`);
  console.log(`   Revenue: ${hre.ethers.formatEther(stats.revenue)} ETH`);
  console.log(`   Total Reviews: ${stats.totalReviewsCount}`);

  const loyalty1 = await hotelBooking.getLoyaltyInfo(guest1.address);
  console.log(`\n🎖️  Guest1 Loyalty: ${loyalty1.points} points`);

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
