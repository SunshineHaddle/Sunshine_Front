import React from "react";
import {
  LayoutDashboard,
  Database,
  BarChart3,
  Globe,
  Settings,
} from "lucide-react";

export default function Sidebar({ currentPage, setCurrentPage }) {
  const NavItem = ({ icon, label, page }) => (
    <button
      onClick={() => setCurrentPage(page)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        currentPage === page
          ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
      }`}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20 transition-all h-full shrink-0">
      <div className="h-16 flex items-center px-6 bg-slate-950 border-b border-slate-800">
        <div className="text-xl font-bold text-white flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-black">해뜰</span>
          </div>
          원가분석 ERP
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        <NavItem
          icon={<LayoutDashboard size={20} />}
          label="메인 대시보드"
          page="dashboard"
        />
        <NavItem
          icon={<Database size={20} />}
          label="기준정보 및 제품 구성"
          page="datainput"
        />
        <NavItem
          icon={<BarChart3 size={20} />}
          label="상세 원가·손익 분석"
          page="analysis"
        />
        <NavItem
          icon={<Globe size={20} />}
          label="수출 시뮬레이션 및 PDF"
          page="reports"
        />
      </div>
      <div className="p-4 border-t border-slate-800">
        <button className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
          <Settings size={20} /> 환경설정
        </button>
      </div>
    </aside>
  );
}
