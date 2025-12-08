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
} from "react-icons/ai";
import { MdRadar, MdAccountTree } from "react-icons/md";
import { Link } from "@tanstack/react-router";

const navigationItems = [
  {
    name: "Dashboard",
    icon: <AiFillDashboard className="text-white text-xl" />,
    path: "/",
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
  return (
    <nav
      ref={ref}
      className="fixed top-0 left-0 right-0 z-50 bg-secondary border-b-2 border-highlights shadow-lg"
    >
      <div className="flex items-center justify-center gap-2 h-16 px-4 overflow-x-auto">
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
    </nav>
  );
});

NavBar.displayName = "NavBar";

export default NavBar;
