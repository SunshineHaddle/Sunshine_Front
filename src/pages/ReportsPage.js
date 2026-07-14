import React, { useState } from "react";
import { Globe, FileText, CheckSquare, Download } from "lucide-react";

const exchangeRates = [
  { currency: "USD", rate: 1380.5, symbol: "$", trend: "+0.17%" },
  { currency: "JPY", rate: 860.2, symbol: "¥", trend: "-0.16%" },
  { currency: "CNY", rate: 190.15, symbol: "¥", trend: "+0.02%" },
  { currency: "EUR", rate: 1485.1, symbol: "€", trend: "+0.05%" },
];

export default function ReportsPage() {
  const [quantity, setQuantity] = useState(1000);
  const [targetMargin, setTargetMargin] = useState(25);

  const baseCostKRW = 10800;
  const totalCostKRW = baseCostKRW * quantity;
  const targetRevenueKRW = totalCostKRW / (1 - targetMargin / 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Globe className="text-blue-400" /> 수출 견적 시뮬레이터 (LIVE)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="col-span-2 grid grid-cols-2 gap-6 bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-semibold">
                제품 선택
              </label>
              <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 outline-none">
                <option>프리미엄 포기김치 (10kg)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-semibold">
                수출 수량 (BOX)
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 font-bold outline-none"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <label className="text-xs text-slate-400 font-semibold">
                목표 마진율 (%)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(e.target.value)}
                  className="flex-1 accent-blue-500 h-2 bg-slate-700 rounded-lg cursor-pointer"
                />
                <span className="text-2xl font-black text-blue-400 w-16">
                  {targetMargin}%
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {exchangeRates.map((fx) => (
              <div
                key={fx.currency}
                className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center"
              >
                <div>
                  <p className="text-xs font-bold text-slate-400">
                    {fx.currency}/KRW
                  </p>
                  <p className="text-lg font-black">{fx.rate}</p>
                </div>
                <div
                  className={`text-xs font-semibold ${
                    fx.trend.includes("+") ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {fx.trend}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-700 grid grid-cols-2 md:grid-cols-5 gap-4">
          {exchangeRates.map((fx) => (
            <div
              key={fx.currency}
              className="bg-blue-900/30 p-4 rounded-xl border border-blue-500/30 text-center"
            >
              <p className="text-xs text-blue-300 font-semibold mb-1">
                제시가 ({fx.currency})
              </p>
              <p className="text-xl font-black text-white">
                {fx.symbol}{" "}
                {(targetRevenueKRW / fx.rate).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          ))}
          <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/30 text-center">
            <p className="text-xs text-emerald-400 font-semibold mb-1">
              예상 영업이익
            </p>
            <p className="text-xl font-bold text-emerald-400">
              ₩ {Math.round(targetRevenueKRW - totalCostKRW).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 border shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <FileText className="text-red-500" /> 맞춤형 PDF 보고서 생성
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">
                1. 보고서 기간 선택
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  className="border rounded-lg p-2 text-sm text-slate-600 outline-none"
                  defaultValue="2026-06"
                />
                <span className="text-slate-400">~</span>
                <input
                  type="month"
                  className="border rounded-lg p-2 text-sm text-slate-600 outline-none"
                  defaultValue="2026-06"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">
                2. 포함 항목 체크박스 리스트
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  "원가 요약 (제조 vs 총원가)",
                  "전월 대비 원가 비교",
                  "품목별 원재료가 비교",
                  "4단계 불량률 추이",
                  "다국어 환율 변동표",
                ].map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer"
                  >
                    <CheckSquare size={16} className="text-blue-600" /> {item}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-slate-50 border rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <FileText size={48} className="text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium mb-4">
              선택하신 조건으로 경영진 보고용
              <br />
              월간 정산 리포트를 생성합니다.
            </p>
            <div className="flex gap-2 w-full">
              <button className="flex-1 bg-white border border-slate-300 text-slate-700 font-bold py-3 rounded-lg hover:bg-slate-100 transition-colors">
                미리보기
              </button>
              <button className="flex-1 bg-red-500 text-white font-bold py-3 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
                <Download size={18} /> PDF 다운로드
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
