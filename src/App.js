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
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  LayoutDashboard,
  Database,
  ShoppingCart,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  UserCircle,
  Bell,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  Minus,
  Globe,
  Calculator,
  Download,
  Upload,
  CheckSquare,
  Search,
} from "lucide-react";

// ==========================================
// 0. 모의 데이터 설정
// ==========================================
const monthlyCostData = [
  { name: "1월", 총원가: 12000, 주제품원가: 7500 },
  { name: "2월", 총원가: 13500, 주제품원가: 8200 },
  { name: "3월", 총원가: 11000, 주제품원가: 6900 },
  { name: "4월", 총원가: 15200, 주제품원가: 9100 },
  { name: "5월", 총원가: 14000, 주제품원가: 8500 },
  { name: "6월", 총원가: 16500, 주제품원가: 9800 },
];

const defectRateData = [
  { name: "원재료", 비율: 3.5 },
  { name: "공정", 비율: 2.1 },
  { name: "완제품", 비율: 1.2 },
];

const initialMaterials = [
  {
    id: 1,
    name: "절임배추 (여름)",
    cost: 4500,
    unit: "kg",
    yield: 85,
    inboundDefect: 3.5,
    processLoss: 2.1,
  },
  {
    id: 2,
    name: "고춧가루 (500g)",
    cost: 12000,
    unit: "봉",
    yield: 100,
    inboundDefect: 1.0,
    processLoss: 0.5,
  },
  {
    id: 3,
    name: "마늘 (200g)",
    cost: 3500,
    unit: "팩",
    yield: 95,
    inboundDefect: 2.0,
    processLoss: 1.0,
  },
  {
    id: 4,
    name: "특제 액젓 (1L)",
    cost: 8000,
    unit: "병",
    yield: 100,
    inboundDefect: 0.5,
    processLoss: 0.2,
  },
];

const exchangeRates = [
  { currency: "USD", rate: 1380.5, symbol: "$", trend: "+0.17%" },
  { currency: "JPY", rate: 860.2, symbol: "¥", trend: "-0.16%" },
  { currency: "CNY", rate: 190.15, symbol: "¥", trend: "+0.02%" },
  { currency: "EUR", rate: 1485.1, symbol: "€", trend: "+0.05%" },
];

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

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

// ==========================================
// 1. 공통 컴포넌트 (Sidebar, Header)
// ==========================================
function Sidebar({ currentPage, setCurrentPage }) {
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

function Header({ currentPage }) {
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

// ==========================================
// 2. 메인 대시보드 페이지
// ==========================================
function DashboardPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <span className="flex items-center text-sm font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-full">
              <TrendingUp size={14} className="mr-1" /> +11.2%
            </span>
          </div>
          <div className="mt-4">
            <p className="text-slate-500 text-sm font-medium mb-1">
              당월 예상 총 제조원가
            </p>
            <h3 className="text-3xl font-bold text-slate-800">
              16,500,000{" "}
              <span className="text-lg text-slate-400 font-normal">KRW</span>
            </h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShoppingCart size={24} />
            </div>
            <span className="flex items-center text-sm font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-full">
              <TrendingUp size={14} className="mr-1" /> +9.5%
            </span>
          </div>
          <div className="mt-4">
            <p className="text-slate-500 text-sm font-medium mb-1">
              주력 제품(포기김치) 총 원가
            </p>
            <h3 className="text-3xl font-bold text-slate-800">
              9,800,000{" "}
              <span className="text-lg text-slate-400 font-normal">KRW</span>
            </h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border shadow-sm">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <BarChart3 size={24} />
            </div>
            <span className="flex items-center text-sm font-semibold text-blue-500 bg-blue-50 px-2 py-1 rounded-full">
              <TrendingDown size={14} className="mr-1" /> -3.5%
            </span>
          </div>
          <div className="mt-4">
            <p className="text-slate-500 text-sm font-medium mb-1">
              평균 영업 이익률
            </p>
            <h3 className="text-3xl font-bold text-slate-800">
              12.5 <span className="text-lg text-slate-400 font-normal">%</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              목표 마진율(15%) 대비 부족
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <TrendingUp className="text-blue-500" /> 월별 원가 변동 추이
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyCostData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b" }} />
                <YAxis tick={{ fill: "#64748b" }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="총원가"
                  stroke="#3b82f6"
                  strokeWidth={3}
                />
                <Line
                  type="monotone"
                  dataKey="주제품원가"
                  stroke="#94a3b8"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" /> 원가 상승 리스크 경고
            (AI 분석)
          </h3>
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg mt-4">
            <p className="text-sm font-bold text-red-800 mb-1">
              여름철 배추 수율 하락 주의
            </p>
            <p className="text-xs text-red-600">
              7월 배추 매입가 예측: 작황 악화로 전월 대비 +18% 상승 예상. 마진율
              8%대 하락 위험.
            </p>
          </div>
          <h3 className="text-sm font-bold text-slate-700 mt-6 mb-2">
            4단계 불량률 및 수율 현황
          </h3>
          <div className="flex-1 h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={defectRateData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  width={60}
                />
                <Tooltip />
                <Bar
                  dataKey="비율"
                  fill="#ef4444"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                >
                  {defectRateData.map((e, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. 데이터 입력 및 장바구니 페이지 (기획서 누락분 복구)
// ==========================================
function DataInputPage() {
  const [materials, setMaterials] = useState(initialMaterials);
  const [recipe, setRecipe] = useState([]);
  const [newMat, setNewMat] = useState({
    name: "",
    cost: "",
    unit: "",
    yield: 100,
    defect: 0,
  });

  // 원재료 직접 추가 로직
  const handleAddMaterial = (e) => {
    e.preventDefault();
    if (newMat.name && newMat.cost) {
      setMaterials([
        ...materials,
        {
          id: Date.now(),
          name: newMat.name,
          cost: Number(newMat.cost),
          unit: newMat.unit || "kg",
          yield: Number(newMat.yield),
          inboundDefect: Number(newMat.defect),
          processLoss: 0,
        },
      ]);
      setNewMat({ name: "", cost: "", unit: "", yield: 100, defect: 0 });
    }
  };

  const addToCart = (mat) => {
    if (!recipe.find((r) => r.id === mat.id))
      setRecipe([...recipe, { ...mat, amount: 1 }]);
  };
  const updateAmount = (id, amt) =>
    setRecipe(
      recipe.map((r) => (r.id === id ? { ...r, amount: Number(amt) } : r)),
    );

  const totalCost = recipe.reduce((acc, curr) => {
    const rawCost = curr.cost * curr.amount;
    const lossMultiplier =
      1 + (curr.inboundDefect + curr.processLoss + (100 - curr.yield)) / 100;
    return acc + rawCost * lossMultiplier;
  }, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
      {/* 3-1. 원재료 입력 폼 (복구됨) */}
      <div className="lg:col-span-5 space-y-6 flex flex-col h-full">
        <div className="bg-white rounded-2xl p-6 border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">
              원재료 직접 입력
            </h3>
            <button className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold transition-colors">
              <Upload size={14} /> 엑셀 업로드
            </button>
          </div>
          <form
            onSubmit={handleAddMaterial}
            className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100"
          >
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">
                원재료명
              </label>
              <input
                type="text"
                value={newMat.name}
                onChange={(e) => setNewMat({ ...newMat, name: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm outline-blue-500"
                placeholder="예: 무 (가을)"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  매입단가 (원)
                </label>
                <input
                  type="number"
                  value={newMat.cost}
                  onChange={(e) =>
                    setNewMat({ ...newMat, cost: e.target.value })
                  }
                  className="w-full border rounded-lg p-2 text-sm outline-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  단위 (kg, 봉)
                </label>
                <input
                  type="text"
                  value={newMat.unit}
                  onChange={(e) =>
                    setNewMat({ ...newMat, unit: e.target.value })
                  }
                  className="w-full border rounded-lg p-2 text-sm outline-blue-500"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  수율 (%)
                </label>
                <input
                  type="number"
                  value={newMat.yield}
                  onChange={(e) =>
                    setNewMat({ ...newMat, yield: e.target.value })
                  }
                  className="w-full border rounded-lg p-2 text-sm outline-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  입고불량률 (%)
                </label>
                <input
                  type="number"
                  value={newMat.defect}
                  onChange={(e) =>
                    setNewMat({ ...newMat, defect: e.target.value })
                  }
                  className="w-full border rounded-lg p-2 text-sm outline-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-lg text-sm transition-colors mt-2"
            >
              목록에 추가
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl p-6 border shadow-sm flex-1 flex flex-col min-h-[300px]">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-4">
            기준 원재료 목록
          </h3>
          <div className="space-y-3 overflow-y-auto pr-2 flex-1">
            {materials.map((m) => (
              <div
                key={m.id}
                className="p-4 border border-slate-100 rounded-xl hover:border-blue-300 flex justify-between items-center bg-slate-50"
              >
                <div>
                  <p className="font-bold text-slate-800 text-sm">{m.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {m.cost.toLocaleString()}원 / {m.unit}
                  </p>
                </div>
                <button
                  onClick={() => addToCart(m)}
                  className="bg-white border text-blue-600 p-2 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3-2. 장바구니 영역 */}
      <div className="lg:col-span-7 flex flex-col h-full">
        <div className="bg-white rounded-2xl p-6 border shadow-lg border-blue-100 h-full flex flex-col">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="text-blue-600" /> 신규 제품 구성 (BOM
              장바구니)
            </h3>
          </div>
          {recipe.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Search size={48} className="mb-4 opacity-20" />
              <p>좌측 목록에서 투입할 원재료를 추가해주세요.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                {recipe.map((item) => {
                  const finalCost =
                    item.cost *
                    item.amount *
                    (1 +
                      (item.inboundDefect +
                        item.processLoss +
                        (100 - item.yield)) /
                        100);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-slate-50 border rounded-xl"
                    >
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          단가: {item.cost.toLocaleString()}원
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-white border rounded-lg overflow-hidden">
                          <span className="px-3 py-1 text-xs text-slate-500 bg-slate-100 border-r">
                            투입량
                          </span>
                          <input
                            type="number"
                            min="1"
                            className="w-16 text-center text-sm font-bold p-1 outline-none"
                            value={item.amount}
                            onChange={(e) =>
                              updateAmount(item.id, e.target.value)
                            }
                          />
                          <span className="px-2 py-1 text-xs text-slate-500">
                            {item.unit}
                          </span>
                        </div>
                        <div className="text-right w-24">
                          <p className="text-sm font-bold text-blue-600">
                            {Math.round(finalCost).toLocaleString()}원
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setRecipe(recipe.filter((r) => r.id !== item.id))
                          }
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Minus size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-6 border-t-2 border-slate-100">
                <div className="flex justify-between items-end">
                  <p className="text-slate-500 font-medium">
                    손실률이 반영된 총 예상 재료비
                  </p>
                  <p className="text-3xl font-black text-slate-800">
                    {Math.round(totalCost).toLocaleString()}{" "}
                    <span className="text-lg text-slate-500">원</span>
                  </p>
                </div>
                <button className="w-full mt-6 bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 shadow-lg">
                  이 레시피로 완제품 원가 저장하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. 상세 원가 및 손익 분석 페이지 (기획서 누락분 복구)
// ==========================================
function AnalysisPage() {
  const [salesPrice, setSalesPrice] = useState(15000);
  const selectedProductCost = detailedCostBreakdown[0].최종원가; // 포기김치 10,800원 기준
  const costRate = ((selectedProductCost / salesPrice) * 100).toFixed(1);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 4-1. 제조원가 vs 경영총원가 비교 (복구됨) */}
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

      {/* 4-2. 원가율 계산기 (복구됨) */}
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
              className={`text-2xl font-black ${costRate > 80 ? "text-red-500" : "text-emerald-500"}`}
            >
              {costRate}%
            </p>
          </div>
        </div>
      </div>

      {/* 4-3. Breakdown 누적 막대 차트 (복구됨) */}
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

// ==========================================
// 5. 수출 견적 시뮬레이터 및 PDF 보고서 (기획서 누락분 완벽 복구)
// ==========================================
function ReportsPage() {
  const [quantity, setQuantity] = useState(1000);
  const [targetMargin, setTargetMargin] = useState(25);

  const baseCostKRW = 10800;
  const totalCostKRW = baseCostKRW * quantity;
  const targetRevenueKRW = totalCostKRW / (1 - targetMargin / 100);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 5-1. 수출 견적 시뮬레이터 */}
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
                  className={`text-xs font-semibold ${fx.trend.includes("+") ? "text-emerald-400" : "text-red-400"}`}
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

      {/* 5-2. PDF 보고서 다운로드 (기획서 9페이지 옵션 복구됨) */}
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

// ==========================================
// 6. 메인 결합부
// ==========================================
export default function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
      case "datainput":
        return <DataInputPage />;
      case "analysis":
        return <AnalysisPage />;
      case "reports":
        return <ReportsPage />;
      default:
        return <DashboardPage />;
    }
  };
  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header currentPage={currentPage} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-8">
          <div className="max-w-7xl mx-auto">{renderPage()}</div>
        </main>
      </div>
    </div>
  );
}
