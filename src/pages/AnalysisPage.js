import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Calculator } from "lucide-react";

const detailedCostBreakdown = [
  {
    item: "포기김치",
    원재료비: 7500,
    인건비: 1500,
    제조간접비: 1000,
    금융비용: 800,
    최종원가: 10800,
  },
  {
    item: "저염 백김치",
    원재료비: 6200,
    인건비: 1200,
    제조간접비: 800,
    금융비용: 600,
    최종원가: 8800,
  },
  {
    item: "깍두기",
    원재료비: 5500,
    인건비: 1000,
    제조간접비: 700,
    금융비용: 500,
    최종원가: 7700,
  },
];

export default function AnalysisPage() {
  const [salesPrice, setSalesPrice] = useState(15000);
  const selectedProductCost = detailedCostBreakdown[0].최종원가;
  const costRate = ((selectedProductCost / salesPrice) * 100).toFixed(1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 text-white rounded-2xl p-6 shadow-md border border-slate-700 flex flex-col justify-center">
          <h3 className="text-slate-400 font-semibold mb-2">
            ① 공장 기준 순수 제조원가
          </h3>
          <p className="text-3xl font-black">
            ₩ 10,000{" "}
            <span className="text-sm font-normal text-slate-400">
              / 포기김치 10kg
            </span>
          </p>
          <p className="text-xs text-slate-400 mt-2">
            포함항목: 원재료비, 노무비(인건비), 제조간접비(전기세 등)
          </p>
        </div>
        <div className="bg-blue-600 text-white rounded-2xl p-6 shadow-md border border-blue-500 flex flex-col justify-center">
          <h3 className="text-blue-200 font-semibold mb-2">
            ② 최종 경영 총원가 (리스크 포함)
          </h3>
          <p className="text-3xl font-black">
            ₩ 10,800{" "}
            <span className="text-sm font-normal text-blue-200">
              / 포기김치 10kg
            </span>
          </p>
          <p className="text-xs text-blue-200 mt-2">
            추가항목: 은행 대출 이자 (금융비용 800원 포함)
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border shadow-sm flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Calculator size={20} /> 실시간 판매가 대비 원가율 계산기
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            포기김치 10kg (경영총원가: 10,800원) 기준
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-400 mb-1">
              시장 판매가 설정 (원)
            </label>
            <input
              type="number"
              value={salesPrice}
              onChange={(e) => setSalesPrice(e.target.value)}
              className="border-2 border-blue-200 rounded-lg p-2 text-lg font-bold text-slate-800 w-48 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="text-center bg-slate-50 px-6 py-2 rounded-xl border">
            <p className="text-xs font-bold text-slate-500">자동 산출 원가율</p>
            <p
              className={`text-2xl font-black ${
                costRate > 80 ? "text-red-500" : "text-emerald-500"
              }`}
            >
              {costRate}%
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-6">
          제품별 원가 요소 Breakdown
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={detailedCostBreakdown}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="item" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="원재료비" stackId="a" fill="#3b82f6" />
              <Bar dataKey="인건비" stackId="a" fill="#10b981" />
              <Bar dataKey="제조간접비" stackId="a" fill="#f59e0b" />
              <Bar
                dataKey="금융비용"
                stackId="a"
                fill="#ef4444"
                name="금융비용(이자)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
