import { useNavigate, useLocation } from "react-router-dom";
import { Home as HomeIcon, CalendarDays, BookOpen } from "lucide-react";

const NavBtn = ({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 transition-colors"
    style={{ color: active ? "hsl(var(--sage))" : "#C0A880" }}
  >
    {icon}
    <span className="text-[10px] font-body font-medium" style={{ letterSpacing: "0.06em" }}>{label}</span>
  </button>
);

export const BottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        background: "hsl(var(--background))",
        borderTop: "1px solid rgba(160, 120, 70, 0.15)",
        paddingTop: "13px",
        paddingBottom: "22px",
      }}
    >
      <div className="flex justify-around max-w-sm mx-auto px-6">
        <NavBtn
          icon={<HomeIcon size={20} strokeWidth={1.6} />}
          label="Home"
          active={pathname === "/home"}
          onClick={() => navigate("/home")}
        />
        <NavBtn
          icon={<CalendarDays size={20} strokeWidth={1.6} />}
          label="My Month"
          active={pathname === "/month"}
          onClick={() => navigate("/month")}
        />
        <NavBtn
          icon={<BookOpen size={20} strokeWidth={1.6} />}
          label="Reflect"
          active={pathname === "/reflect"}
          onClick={() => navigate("/reflect")}
        />
      </div>
    </nav>
  );
};
