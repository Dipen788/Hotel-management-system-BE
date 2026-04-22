import { useState } from "react";
import { ToastProvider } from "./contexts/ToastContext";
import { WalletProvider, useWallet } from "./contexts/WalletContext";
import { AuthProvider } from "./contexts/AuthContext";
import useContract from "./hooks/useContract";
import { TransactionOverlay, PageLoader } from "./components/common/LoadingSpinner";
import Navbar from "./components/layout/Navbar";
import ConnectPrompt from "./components/pages/ConnectPrompt";
import Dashboard from "./components/pages/Dashboard";
import RoomsPage from "./components/pages/RoomsPage";
import BookingsPage from "./components/pages/BookingsPage";
import AdminPage from "./components/pages/AdminPage";
import ProfilePage from "./components/pages/ProfilePage";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { styles as themeStyles } from "./styles/theme";
import { globalStyles } from "./styles/animations";

function AppShell() {
  const { account } = useWallet();
  const [page, setPage] = useState("dashboard");
  const {
    rooms, bookings, stats, loyaltyInfo,
    loading, txPending, txMessage, lastTxHash,
    createRoom, deactivateRoom,
    bookRoom, cancelBooking,
    checkIn, checkOut,
    withdrawFunds,
    submitReview, getRoomReviews, getRoomRating,
  } = useContract();

  // Not connected → connect screen (but allow Profile even without wallet so
  // users can register before connecting).
  if (!account && page !== "profile") {
    return (
      <div style={themeStyles.app}>
        <Navbar page={page} setPage={setPage} loyaltyInfo={loyaltyInfo} />
        <main style={themeStyles.container}>
          <ConnectPrompt onSignIn={() => setPage("profile")} />
        </main>
      </div>
    );
  }

  return (
    <div style={themeStyles.app}>
      <Navbar page={page} setPage={setPage} loyaltyInfo={loyaltyInfo} />
      <main style={themeStyles.container}>
        {loading && account && page !== "profile" ? (
          <PageLoader />
        ) : (
          <>
            {page === "dashboard" && account && (
              <Dashboard stats={stats} rooms={rooms} bookings={bookings} lastTxHash={lastTxHash} />
            )}
            {page === "rooms" && account && (
              <RoomsPage
                rooms={rooms}
                onBook={bookRoom}
                onDeactivate={deactivateRoom}
                getRoomReviews={getRoomReviews}
                getRoomRating={getRoomRating}
              />
            )}
            {page === "bookings" && account && (
              <BookingsPage
                bookings={bookings}
                rooms={rooms}
                onCancel={cancelBooking}
                onCheckIn={checkIn}
                onCheckOut={checkOut}
                onSubmitReview={submitReview}
              />
            )}
            {page === "admin" && account && (
              <AdminPage
                stats={stats}
                rooms={rooms}
                bookings={bookings}
                onCreateRoom={createRoom}
                onWithdraw={withdrawFunds}
              />
            )}
            {page === "profile" && <ProfilePage />}
          </>
        )}
      </main>
      {txPending && <TransactionOverlay message={txMessage} />}
    </div>
  );
}

export default function App() {
  return (
    <>
      <style>{globalStyles}</style>
      <ErrorBoundary>
        <ToastProvider>
          <AuthProvider>
            <WalletProvider>
              <AppShell />
            </WalletProvider>
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </>
  );
}
