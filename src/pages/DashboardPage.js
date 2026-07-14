import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Info,
} from "lucide-react";

// ==========================================
// 1. 모의 데이터 설정
// ==========================================
const monthlyCostData = [
  { name: "1월", 경영총원가: 12000, 제조원가: 7500 },
  { name: "2월", 경영총원가: 13500, 제조원가: 8200 },
  { name: "3월", 경영총원가: 11000, 제조원가: 6900 },
  { name: "4월", 경영총원가: 15200, 제조원가: 9100 },
  { name: "5월", 경영총원가: 14800, 제조원가: 8800 },
  { name: "6월", 경영총원가: 16500, 제조원가: 10200 }, // 저번 달
  { name: "7월", 경영총원가: 17200, 제조원가: 10800 }, // 이번 달
];

export default function DashboardPage() {
  // 상세 요약 뷰 토글 상태
  const [showDetailSummary, setShowDetailSummary] = useState(false);

  // 이번 달 vs 저번 달 데이터 추출
  const lastMonth = monthlyCostData[monthlyCostData.length - 2];
  const thisMonth = monthlyCostData[monthlyCostData.length - 1];

  // 카드 클릭 시 이벤트 (추후 라우팅으로 연결)
  const handleCardClick = (pageName) => {
    alert(`${pageName} 상세페이지로 이동합니다.`);
    // 실제 적용 시에는 React Router의 navigate('/경로') 등을 사용합니다.
  };

  return (
    <div
      style={{
        padding: "24px",
        width: "100%",
        boxSizing: "border-box",
        backgroundColor: "#f8f9fa",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: "#1f2937",
            margin: "0 0 8px 0",
          }}
        >
          경영 대시보드
        </h2>
        <p style={{ color: "#6b7280", margin: "0" }}>
          해뜰종합식품의 핵심 지표를 한눈에 파악하세요.
        </p>
      </div>

      {/* ========================================== */}
      {/* 2. 상단 요약 KPI 카드 (3개) */}
      {/* ========================================== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        {/* 카드 1: 환율 정보 */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={cardTitleStyle}>환율 정보 (USD/KRW)</p>
              <h3 style={cardValueStyle}>1,382.50 원</h3>
              <p
                style={{
                  color: "#ef4444",
                  fontSize: "14px",
                  margin: "4px 0 0 0",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <TrendingUp size={16} style={{ marginRight: "4px" }} /> 전일대비
                +2.3원
              </p>
            </div>
            <div
              style={{
                ...iconWrapperStyle,
                backgroundColor: "#dbeafe",
                color: "#3b82f6",
              }}
            >
              <DollarSign size={24} />
            </div>
          </div>
          <div
            style={cardFooterStyle}
            onClick={() => handleCardClick("환율 정보")}
          >
            <span style={{ fontSize: "14px", fontWeight: "500" }}>
              상세페이지
            </span>
            <ArrowRight size={16} />
          </div>
        </div>

        {/* 카드 2: 원가 변동 추이 */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={cardTitleStyle}>당월 경영총원가 (예상)</p>
              <h3 style={cardValueStyle}>17,200 만원</h3>
              <p
                style={{
                  color: "#ef4444",
                  fontSize: "14px",
                  margin: "4px 0 0 0",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <TrendingUp size={16} style={{ marginRight: "4px" }} /> 전월대비
                +4.2%
              </p>
            </div>
            <div
              style={{
                ...iconWrapperStyle,
                backgroundColor: "#fef3c7",
                color: "#f59e0b",
              }}
            >
              <TrendingUp size={24} />
            </div>
          </div>
          <div
            style={cardFooterStyle}
            onClick={() => handleCardClick("원가 분석")}
          >
            <span style={{ fontSize: "14px", fontWeight: "500" }}>
              상세페이지
            </span>
            <ArrowRight size={16} />
          </div>
        </div>

        {/* 카드 3: 불량품 현황 */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <p style={cardTitleStyle}>당월 불량률 현황</p>
              <h3 style={cardValueStyle}>1.2 %</h3>
              <p
                style={{
                  color: "#10b981",
                  fontSize: "14px",
                  margin: "4px 0 0 0",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <TrendingDown size={16} style={{ marginRight: "4px" }} />{" "}
                전월대비 -0.3% (안정)
              </p>
            </div>
            <div
              style={{
                ...iconWrapperStyle,
                backgroundColor: "#fee2e2",
                color: "#ef4444",
              }}
            >
              <AlertTriangle size={24} />
            </div>
          </div>
          <div
            style={cardFooterStyle}
            onClick={() => handleCardClick("불량품 관리")}
          >
            <span style={{ fontSize: "14px", fontWeight: "500" }}>
              상세페이지
            </span>
            <ArrowRight size={16} />
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 3. 메인 차트 및 상세 비교 영역 */}
      {/* ========================================== */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              margin: "0",
              display: "flex",
              alignItems: "center",
            }}
          >
            월별 원가 변동 추이
          </h3>
          {/* 상세 페이지 버튼 */}
          <button
            onClick={() => setShowDetailSummary(!showDetailSummary)}
            style={{
              padding: "8px 16px",
              backgroundColor: showDetailSummary ? "#1e3a8a" : "#eff6ff",
              color: showDetailSummary ? "#ffffff" : "#1e3a8a",
              border: "1px solid #bfdbfe",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              transition: "all 0.2s",
            }}
          >
            <Info size={18} style={{ marginRight: "6px" }} />
            {showDetailSummary ? "상세 요약 닫기" : "상세 페이지 (비교 요약)"}
          </button>
        </div>

        {/* 상세 요약 뷰 (버튼 클릭 시 노출) */}
        {showDetailSummary && (
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <h4 style={{ margin: "0 0 16px 0", color: "#334155" }}>
              📊 이번 달 vs 저번 달 원가 요약 비교
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
              }}
            >
              {/* 제조원가 비교 */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#ffffff",
                  borderRadius: "6px",
                  borderLeft: "4px solid #3b82f6",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px 0",
                    color: "#64748b",
                    fontWeight: "500",
                  }}
                >
                  제조원가 비교
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span>{lastMonth.name} (저번 달):</span>
                  <strong>{lastMonth.제조원가.toLocaleString()} 만원</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span>{thisMonth.name} (이번 달):</span>
                  <strong>{thisMonth.제조원가.toLocaleString()} 만원</strong>
                </div>
                <hr
                  style={{
                    border: "0",
                    borderTop: "1px solid #e2e8f0",
                    margin: "8px 0",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#ef4444",
                    fontWeight: "bold",
                  }}
                >
                  <span>증감액:</span>
                  <span>
                    +
                    {(thisMonth.제조원가 - lastMonth.제조원가).toLocaleString()}{" "}
                    만원
                  </span>
                </div>
              </div>

              {/* 경영총원가 비교 */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#ffffff",
                  borderRadius: "6px",
                  borderLeft: "4px solid #10b981",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px 0",
                    color: "#64748b",
                    fontWeight: "500",
                  }}
                >
                  경영총원가 비교
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span>{lastMonth.name} (저번 달):</span>
                  <strong>{lastMonth.경영총원가.toLocaleString()} 만원</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span>{thisMonth.name} (이번 달):</span>
                  <strong>{thisMonth.경영총원가.toLocaleString()} 만원</strong>
                </div>
                <hr
                  style={{
                    border: "0",
                    borderTop: "1px solid #e2e8f0",
                    margin: "8px 0",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#ef4444",
                    fontWeight: "bold",
                  }}
                >
                  <span>증감액:</span>
                  <span>
                    +
                    {(
                      thisMonth.경영총원가 - lastMonth.경영총원가
                    ).toLocaleString()}{" "}
                    만원
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 라인 차트 영역 */}
        <div style={{ width: "100%", height: "400px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlyCostData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280" }}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Line
                type="monotone"
                dataKey="경영총원가"
                name="경영총원가 (단위: 만원)"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="제조원가"
                name="제조원가 (단위: 만원)"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. 공통 스타일 객체
// ==========================================
const cardStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  overflow: "hidden",
};

const cardHeaderStyle = {
  padding: "24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const cardTitleStyle = {
  fontSize: "14px",
  color: "#6b7280",
  fontWeight: "600",
  margin: "0 0 8px 0",
};

const cardValueStyle = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#111827",
  margin: "0",
};

const iconWrapperStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardFooterStyle = {
  backgroundColor: "#f9fafb",
  padding: "12px 24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#1e3a8a",
  cursor: "pointer",
  borderTop: "1px solid #f3f4f6",
  transition: "background-color 0.2s",
};
