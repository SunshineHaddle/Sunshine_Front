import React from "react";
import { Bell, UserCircle, LogOut } from "lucide-react";

export default function Header({ currentPage }) {
  const titles = {
    dashboard: "6월 경영 총원가 대시보드",
    datainput: "기준정보 관리 및 장바구니 제품 구성",
    analysis: "제품별 상세 원가 구조 및 손익 분석",
    reports: "수출 견적 시뮬레이터 및 PDF 보고서",
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 w-full shrink-0">
      <h1 className="text-xl font-bold text-slate-800">
        {titles[currentPage]}
      </h1>
      <div className="flex items-center gap-6">
        <button className="text-slate-400 hover:text-blue-600 relative">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-3 border-l pl-6 border-slate-200">
          <UserCircle size={28} className="text-slate-400" />
          <div className="text-sm">
            <p className="font-semibold text-slate-700">관리자(이사)님</p>
            <p className="text-xs text-slate-500">경영지원팀</p>
          </div>
          <button className="ml-4 text-slate-400 hover:text-red-500">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
