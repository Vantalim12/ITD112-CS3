import { forwardRef } from "react";

const Header = forwardRef<HTMLElement>((_props, ref) => {
  return (
    <header
      ref={ref}
      className="flex justify-center items-center px-6 py-3 bg-primary border-b border-highlights/30"
    >
      <h1 className="text-2xl md:text-3xl font-inter text-white text-stroke">
        Filipino Emigration Dashboard
      </h1>
    </header>
  );
});

Header.displayName = "Header";

export default Header;
