import { useRef, useEffect } from "react";
import { Outlet, createRootRoute, useLocation, useNavigate } from "@tanstack/react-router";
import Header from "../components/header";
import NavBar from "../components/navBar";
import { NavBarProvider } from "../context/navBarContext";
import { AuthProvider, useAuth } from "../context/authContext";

const RootLayoutContent = () => {
  const headerRef = useRef<HTMLElement>(null);
  const navBarRef = useRef<HTMLElement>(null);
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Don't show nav/header on login/landing page (root)
  const isLoginPage = location.pathname === "/login" || location.pathname === "/";

  // Redirect to landing page if user logs out while on a protected page
  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      navigate({ to: "/" });
    }
  }, [user, loading, isLoginPage, navigate]);

  if (isLoginPage || (!user && !loading)) {
    // Just show the outlet without nav/header for login page
    return (
      <div className="min-h-screen bg-primary">
        <Outlet />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-gray-300">Loading...</div>
      </div>
    );
  }

  // Show full layout with nav/header for authenticated users
  return (
    <div className="app-layout flex flex-col h-screen">
      <nav className="topbar" role="navigation" aria-label="Main navigation">
        <NavBar ref={navBarRef} />
      </nav>

      <div
        className="main-content flex-1 flex flex-col overflow-hidden"
        style={{ marginTop: "4rem" }}
      >
        <Header ref={headerRef} />

        <main
          className="content flex-1 overflow-auto px-4 py-2 bg-primary"
          role="main"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const Route = createRootRoute({
  component: () => {
    return (
      <AuthProvider>
        <NavBarProvider>
          <RootLayoutContent />
        </NavBarProvider>
      </AuthProvider>
    );
  },
});
