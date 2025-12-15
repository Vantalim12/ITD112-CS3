import { forwardRef } from "react";
import {
  AiFillDashboard,
  AiOutlineBarChart,
  AiOutlinePieChart,
  AiOutlineLineChart,
  AiOutlineAreaChart,
  AiOutlineDotChart,
  AiOutlineUpload,
  AiOutlineGlobal,
  AiOutlineDatabase,
  AiOutlineUser,
  AiOutlineLogout,
} from "react-icons/ai";
import { MdRadar, MdAccountTree } from "react-icons/md";
import { TbChartDots3 } from "react-icons/tb";
import { GiArtificialIntelligence } from "react-icons/gi";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../context/authContext";

const navigationItems = [
  {
    name: "Dashboard",
    icon: <AiFillDashboard className="text-white text-xl" />,
    path: "/dashboard",
  },
  {
    name: "Geographic",
    icon: <AiOutlineGlobal className="text-white text-xl" />,
    path: "/geographic",
  },
  {
    name: "Comparison",
    icon: <AiOutlineBarChart className="text-white text-xl" />,
    path: "/comparison",
  },
  {
    name: "Composition",
    icon: <AiOutlinePieChart className="text-white text-xl" />,
    path: "/composition",
  },
  {
    name: "Trends",
    icon: <AiOutlineLineChart className="text-white text-xl" />,
    path: "/trends",
  },
  {
    name: "ML Training",
    icon: <GiArtificialIntelligence className="text-white text-xl" />,
    path: "/train",
  },
  {
    name: "ML Forecast",
    icon: <TbChartDots3 className="text-white text-xl" />,
    path: "/forecast",
  },
  {
    name: "Distribution",
    icon: <AiOutlineAreaChart className="text-white text-xl" />,
    path: "/distribution",
  },
  {
    name: "Relationships",
    icon: <AiOutlineDotChart className="text-white text-xl" />,
    path: "/relationships",
  },
  {
    name: "Ranking",
    icon: <MdRadar className="text-white text-xl" />,
    path: "/radar",
  },
  {
    name: "Flow/Process",
    icon: <MdAccountTree className="text-white text-xl" />,
    path: "/parallel",
  },
  {
    name: "Upload Data",
    icon: <AiOutlineUpload className="text-white text-xl" />,
    path: "/upload",
  },
  {
    name: "Data Management",
    icon: <AiOutlineDatabase className="text-white text-xl" />,
    path: "/crud",
  },
];

const NavBar = forwardRef<HTMLElement>((_props, ref) => {
  const { user, userProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Redirect to landing page after successful logout
      navigate({ to: "/" });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <nav
      ref={ref}
      className="fixed top-0 left-0 right-0 z-50 bg-secondary border-b-2 border-highlights shadow-lg"
    >
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2 overflow-x-auto flex-1">
          {navigationItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap hover:cursor-pointer duration-300 ease-in-out"
            >
              {item.icon}
              <span className="text-white text-sm">{item.name}</span>
            </Link>
          ))}
        </div>
        
        {user && (
          <div className="flex items-center gap-2 ml-4">
            <Link
              to="/profile"
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap"
            >
              <AiOutlineUser className="text-white text-xl" />
              <div className="flex flex-col">
                <span className="text-white text-xs">{userProfile?.displayName || 'User'}</span>
                <span className="text-gray-400 text-[10px] uppercase">{userProfile?.role || 'viewer'}</span>
              </div>
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 hover:bg-red-600/20 rounded-lg transition-colors"
              title="Sign Out"
            >
              <AiOutlineLogout className="text-red-400 text-xl" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
});

NavBar.displayName = "NavBar";

export default NavBar;
