import React, { useState } from "react";
import { Upload, Plus, Minus, Search, ShoppingCart } from "lucide-react";

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

export default function DataInputPage() {
  const [materials, setMaterials] = useState(initialMaterials);
  const [recipe, setRecipe] = useState([]);
  const [newMat, setNewMat] = useState({
    name: "",
    cost: "",
    unit: "",
    yield: 100,
    defect: 0,
  });

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
