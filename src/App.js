import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { FiTrash2 } from "react-icons/fi";

function App() {
  const [roommates, setRoommates] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddRoommate, setShowAddRoommate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roommateToDelete, setRoommateToDelete] = useState(null);
  const [newRoommate, setNewRoommate] = useState("");
  const [saving, setSaving] = useState(false);
  const [paidByFilter, setPaidByFilter] = useState("All");

  // Editable Rent and Water
  const [rentAmount, setRentAmount] = useState(7000);
  const [waterAmount, setWaterAmount] = useState(200);
  const [electricityAmount, setElectricityAmount] = useState(0);

  // Expense form state
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [description, setDescription] = useState("");

  useEffect(() => {
    const unsubRoommates = onSnapshot(collection(db, "roommates"), (snap) => {
      const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRoommates(data);
    });
    const q = query(collection(db, "expenses"), orderBy("date", "desc"));
    const unsubExpenses = onSnapshot(q, (snap) => {
      setExpenses(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubRoommates();
      unsubExpenses();
    };
  }, []);

  const activeRoommates = roommates.filter((r) => r.active);
  //const currentUser = activeRoommates[0]?.name || "You";

  const categories = [
    { name: "Grocery", icon: "🛒", color: "#10b981" },
    { name: "Others", icon: "⋯", color: "#6b7280" },
  ];

  // Total = Expenses + Rent + Water
  const otherExpensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses =
    otherExpensesTotal + rentAmount + waterAmount + electricityAmount;

  // PAYMENT CALCULATIONS
  const totalRoommates = activeRoommates.length;
  const equalShare = totalRoommates > 0 ? totalExpenses / totalRoommates : 0;

  const roommatePayments = activeRoommates.map((r) => {
    const paid = expenses
      .filter((e) => e.paidBy === r.name)
      .reduce((sum, e) => sum + e.amount, 0);
    const balance = paid - equalShare;
    return {
      name: r.name,
      paid,
      share: equalShare,
      balance,
    };
  });

  const needsTotal = roommatePayments
    .filter((r) => r.balance < 0) // only people who owe
    .reduce((sum, r) => sum + Math.abs(r.balance), 0); // sum their negative balance

  const addRoommate = async () => {
    if (!newRoommate.trim()) return;
    await addDoc(collection(db, "roommates"), {
      name: newRoommate.trim(),
      active: true,
      joinedDate: Date.now(),
    });
    setNewRoommate("");
    setShowAddRoommate(false);
  };

  const deactivateRoommate = async (id) => {
    await updateDoc(doc(db, "roommates", id), { active: false });
  };

  const confirmDeleteRoommate = (id, name) => {
    setRoommateToDelete({ id, name });
    setShowDeleteConfirm(true);
  };

  const handleDeleteRoommate = async () => {
    if (roommateToDelete) {
      await deactivateRoommate(roommateToDelete.id);
    }
    setShowDeleteConfirm(false);
    setRoommateToDelete(null);
  };

  const recentExpenses = expenses.slice(0, 4);

  const getExpenseIcon = (desc) => {
    const d = desc.toLowerCase();
    if (d.includes("rent")) return { icon: "🏠", bg: "#eef2ff" };
    if (d.includes("electric")) return { icon: "⚡", bg: "#fffbeb" };
    if (d.includes("grocery") || d.includes("milk"))
      return { icon: "🛒", bg: "#f0fdf4" };
    return { icon: "📦", bg: "#fffbeb" };
  };

  const formatDate = (timestamp, dateDisplay) => {
    // use new field if exists, else fallback to old timestamp
    if (dateDisplay) return dateDisplay;
    return new Date(timestamp).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  };

  const saveExpense = async () => {
    if (!amount) return alert("Please enter amount");
    if (!category) return alert("Please select category");
    if (!paidBy) return alert("Please select who paid");
    if (activeRoommates.length === 0)
      return alert("Please add at least 1 roommate");

    setSaving(true);
    try {
      const splitWith = activeRoommates.map((r) => r.name);
      const selectedDate = new Date(expenseDate);

      const dateForDisplay = selectedDate
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .replace(/ /g, "-"); // "02 Jul 2026" -> "02-Jul-2026"

      await addDoc(collection(db, "expenses"), {
        amount: parseFloat(amount),
        description: category + (description ? `: ${description}` : ""),
        paidBy,
        splitWith,
        date: selectedDate.getTime(), // keep this for sorting
        dateDisplay: dateForDisplay, // "02-Jul-2026" for Firebase
        createdAt: Date.now(),
      });
      setAmount("");
      setCategory("");
      setPaidBy("");
      setDescription("");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setActiveTab("dashboard");
      alert("Expense saved successfully!");
    } catch (error) {
      console.error("Error saving expense:", error);
      alert("Error: " + error.message);
    }
    setSaving(false);
  };

  const deleteExpense = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await deleteDoc(doc(db, "expenses", id));
      alert("Expense deleted!");
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("Error: " + error.message);
    }
  };
  // History Logic
  const filteredExpenses = expenses.filter((exp) => {
    if (paidByFilter === "All") return true;
    return exp.paidBy === paidByFilter;
  });

  const totalFilteredAmount = filteredExpenses.reduce(
    (sum, e) => sum + e.amount,
    0,
  );

  const styles = {
    app: {
      minHeight: "100vh",
      backgroundColor: "#f8fafc",
      fontFamily: "system-ui, -apple-system, sans-serif",
      paddingBottom: "80px",
    },
    container: { maxWidth: "480px", margin: "0 auto", padding: "20px 16px" },
    header: {
      fontSize: "20px",
      fontWeight: "700",
      color: "#0f172a",
      textAlign: "center",
      marginBottom: "20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backBtn: { fontSize: "24px", cursor: "pointer", color: "#0f172a" },
    totalCard: {
      background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
      borderRadius: "20px",
      padding: "24px",
      color: "white",
      marginBottom: "20px",
      boxShadow: "0 10px 25px rgba(99,102,241,0.3)",
    },
    totalLabel: { fontSize: "14px", opacity: 0.9, marginBottom: "4px" },
    totalAmount: { fontSize: "32px", fontWeight: "700", marginBottom: "8px" },
    balanceRow: { display: "flex", gap: "12px", marginBottom: "24px" },
    balanceCard: {
      flex: 1,
      backgroundColor: "white",
      borderRadius: "16px",
      padding: "16px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    },
    balanceLabel: { fontSize: "13px", color: "#64748b", marginBottom: "6px" },
    balanceInput: {
      width: "100%",
      fontSize: "20px",
      fontWeight: "700",
      border: "none",
      outline: "none",
      backgroundColor: "transparent",
    },
    balancePerson: { fontSize: "12px", color: "#94a3b8", marginTop: "2px" },
    sectionHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "12px",
    },
    sectionTitle: { fontSize: "18px", fontWeight: "600", color: "#0f172a" },
    viewAll: {
      fontSize: "14px",
      color: "#6366f1",
      fontWeight: "500",
      cursor: "pointer",
    },
    addBtn: {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      backgroundColor: "#6366f1",
      color: "white",
      border: "none",
      fontSize: "20px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    roommateList: {
      backgroundColor: "white",
      borderRadius: "16px",
      padding: "16px",
      marginBottom: "20px",
    },
    roommateItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: "1px solid #f1f5f9",
    },
    roommateName: { fontSize: "15px", fontWeight: "500", color: "#0f172a" },
    removeIconBtn: {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      backgroundColor: "#fef2f2",
      color: "#ef4444",
      border: "none",
      fontSize: "16px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    expenseItem: {
      backgroundColor: "white",
      borderRadius: "16px",
      padding: "14px",
      marginBottom: "10px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    },
    expenseIcon: {
      width: "44px",
      height: "44px",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
    },
    expenseInfo: { flex: 1 },
    expenseTitle: {
      fontSize: "15px",
      fontWeight: "600",
      color: "#0f172a",
      marginBottom: "2px",
    },
    expenseSub: { fontSize: "13px", color: "#64748b" },
    expenseAmount: { fontSize: "16px", fontWeight: "700", color: "#0f172a" },
    historyHeader: { fontSize: "24px", fontWeight: "700", color: "#0f172a" },
    dropdown: {
      width: "100%",
      padding: "14px",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      fontSize: "16px",
      boxSizing: "border-box",
      marginBottom: "16px",
      backgroundColor: "white",
    },
    sumCard: {
      backgroundColor: "#eef2ff",
      borderRadius: "12px",
      padding: "16px",
      marginBottom: "16px",
      textAlign: "center",
    },
    sumLabel: { fontSize: "13px", color: "#6366f1", marginBottom: "4px" },
    sumAmount: { fontSize: "24px", fontWeight: "700", color: "#3730a3" },
    modal: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
    },
    modalContent: {
      backgroundColor: "white",
      borderRadius: "20px",
      padding: "24px",
      width: "90%",
      maxWidth: "400px",
    },
    modalTitle: {
      fontSize: "18px",
      fontWeight: "700",
      marginBottom: "16px",
      color: "#0f172a",
    },
    input: {
      width: "100%",
      padding: "14px",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      fontSize: "16px",
      boxSizing: "border-box",
      marginBottom: "16px",
    },
    modalBtns: { display: "flex", gap: "10px" },
    modalBtn: {
      flex: 1,
      padding: "14px",
      border: "none",
      borderRadius: "12px",
      fontSize: "16px",
      fontWeight: "600",
      cursor: "pointer",
    },
    cancelBtn: { backgroundColor: "#f1f5f9", color: "#475569" },
    confirmBtn: { backgroundColor: "#6366f1", color: "white" },
    formCard: {
      backgroundColor: "white",
      borderRadius: "16px",
      padding: "20px",
      marginBottom: "16px",
    },
    label: {
      fontSize: "14px",
      fontWeight: "500",
      color: "#475569",
      marginBottom: "8px",
      display: "block",
    },
    select: {
      width: "100%",
      padding: "14px",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      fontSize: "16px",
      boxSizing: "border-box",
      marginBottom: "16px",
      backgroundColor: "white",
    },
    categoryGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "10px",
      marginBottom: "16px",
    },
    categoryCard: {
      padding: "12px 8px",
      border: "2px solid #e2e8f0",
      borderRadius: "12px",
      textAlign: "center",
      cursor: "pointer",
      transition: "all 0.2s",
    },
    categoryCardActive: { borderColor: "#6366f1", backgroundColor: "#eef2ff" },
    categoryIcon: { fontSize: "24px", marginBottom: "4px" },
    categoryName: { fontSize: "12px", fontWeight: "500", color: "#475569" },
    saveBtn: {
      width: "100%",
      padding: "16px",
      backgroundColor: "#6366f1",
      color: "white",
      border: "none",
      borderRadius: "12px",
      fontSize: "16px",
      fontWeight: "700",
      cursor: "pointer",
      marginTop: "8px",
    },
    saveBtnDisabled: { opacity: 0.5 },
    infoText: {
      fontSize: "14px",
      color: "#64748b",
      backgroundColor: "#f1f5f9",
      padding: "12px",
      borderRadius: "10px",
      marginBottom: "16px",
      textAlign: "center",
    },
    bottomNav: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "white",
      borderTop: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-around",
      padding: "8px 0",
      maxWidth: "480px",
      margin: "0 auto",
    },
    navItem: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "8px",
      cursor: "pointer",
      color: "#94a3b8",
    },
    navItemActive: { color: "#6366f1" },
    navIcon: { fontSize: "24px", marginBottom: "4px" },
    navLabel: { fontSize: "11px", fontWeight: "500" },
    placeholder: {
      textAlign: "center",
      padding: "60px 20px",
      color: "#94a3b8",
    },

    // Payment Styles
    paymentSummaryCard: {
      backgroundColor: "white",
      borderRadius: "16px",
      padding: "20px",
      marginBottom: "20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    },
    paymentRow: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "10px",
    },
    paymentLabel: { fontSize: "15px", color: "#64748b" },
    paymentValue: { fontSize: "15px", fontWeight: "700", color: "#0f172a" },
    paymentCard: {
      backgroundColor: "white",
      borderRadius: "16px",
      padding: "16px",
      marginBottom: "12px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    },
    paymentCardHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "10px",
    },
    paymentCardName: { fontSize: "16px", fontWeight: "700", color: "#0f172a" },
    paymentCardRow: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "14px",
      marginBottom: "6px",
    },
    paymentPositive: { color: "#10b981", fontWeight: "700" },
    paymentNegative: { color: "#ef4444", fontWeight: "700" },
  };

  const renderDashboard = () => (
    <div style={styles.container}>
      {/* HEADER WITH LOGO */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <img
          src="/roomexpense_logo_centered.png"
          alt="RoomBook"
          style={{ width: "40px", height: "40px", borderRadius: "10px" }}
        />
        <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>
          RoomBook
        </div>
      </div>
      <div style={styles.totalCard}>
        <div style={styles.totalLabel}>Total Expenses</div>
        <div style={styles.totalAmount}>
          ₹{totalExpenses.toLocaleString("en-IN")}
        </div>
        <div style={styles.totalLabel}>
          {new Date().toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      {/* EDITABLE RENT + WATER */}
      <div style={styles.balanceRow}>
        <div style={styles.balanceCard}>
          <div style={styles.balanceLabel}>Rent</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{ fontSize: "20px", fontWeight: "700", color: "#6366f1" }}
            >
              ₹
            </span>
            <input
              type="text"
              style={{ ...styles.balanceInput, color: "#6366f1" }}
              value={rentAmount.toLocaleString("en-IN")}
              onChange={(e) => {
                const val = e.target.value.replace(/,/g, ""); // remove commas
                setRentAmount(parseFloat(val) || 0);
              }}
            />
          </div>
          <div style={styles.balancePerson}>This Month</div>
        </div>

        <div style={styles.balanceCard}>
          <div style={styles.balanceLabel}>Water</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{ fontSize: "20px", fontWeight: "700", color: "#10b981" }}
            >
              ₹
            </span>
            <input
              type="text"
              style={{ ...styles.balanceInput, color: "#10b981" }}
              value={waterAmount.toLocaleString("en-IN")}
              onChange={(e) => {
                const val = e.target.value.replace(/,/g, ""); // remove commas
                setWaterAmount(parseFloat(val) || 0);
              }}
            />
          </div>
          <div style={styles.balancePerson}>This Month</div>
        </div>

        <div style={styles.balanceCard}>
          <div style={styles.balanceLabel}>Electricity</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {" "}
            <span
              style={{ fontSize: "20px", fontWeight: "700", color: "#10b981" }}
            >
              ₹
            </span>
            <input
              type="text"
              style={{ ...styles.balanceInput, color: "#10b981" }}
              value={electricityAmount.toLocaleString("en-IN")}
              onChange={(e) => {
                const val = e.target.value.replace(/,/g, ""); // remove commas
                setElectricityAmount(parseFloat(val) || 0);
              }}
            />
          </div>
          <div style={styles.balancePerson}>This Month</div>
        </div>
      </div>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitle}>Roommates</div>
        <button style={styles.addBtn} onClick={() => setShowAddRoommate(true)}>
          +
        </button>
      </div>

      <div style={styles.roommateList}>
        {activeRoommates.length === 0 ? (
          <div
            style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}
          >
            Tap + to add roommates
          </div>
        ) : (
          activeRoommates.map((r) => (
            <div key={r.id} style={styles.roommateItem}>
              <div style={styles.roommateName}>{r.name}</div>
              <button
                style={styles.removeIconBtn}
                onClick={() => confirmDeleteRoommate(r.id, r.name)}
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitle}>Recent Expenses</div>
        <div style={styles.viewAll} onClick={() => setActiveTab("history")}>
          View All
        </div>
      </div>

      {recentExpenses.length === 0 ? (
        <div style={styles.placeholder}>
          No expenses yet. Add your first one!
        </div>
      ) : (
        recentExpenses.map((exp) => {
          const { icon, bg } = getExpenseIcon(exp.description);
          return (
            <div key={exp.id} style={styles.expenseItem}>
              <div style={{ ...styles.expenseIcon, backgroundColor: bg }}>
                {icon}
              </div>
              <div style={styles.expenseInfo}>
                <div style={styles.expenseTitle}>{exp.description}</div>
                <div style={styles.expenseSub}>
                  Paid by {exp.paidBy} • {formatDate(exp.date)}
                </div>
              </div>
              <div style={styles.expenseAmount}>₹{exp.amount}</div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderExpense = () => (
    <div style={styles.container}>
      <div style={styles.header}>
        {/* <span style={styles.backBtn} onClick={() => setActiveTab("dashboard")}>
          ←
        </span> */}
        <div>Add Expense</div>
        <div>💰</div>
      </div>

      <div style={styles.formCard}>
        <label style={styles.label}>Date</label>
        <input
          style={styles.input}
          type="date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
        />

        <label style={styles.label}>Paid By</label>
        <select
          style={styles.select}
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
        >
          <option value="">Select person</option>
          {activeRoommates.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>

        <label style={styles.label}>Category</label>
        <div style={styles.categoryGrid}>
          {categories.map((cat) => (
            <div
              key={cat.name}
              style={{
                ...styles.categoryCard,
                ...(category === cat.name ? styles.categoryCardActive : {}),
              }}
              onClick={() => setCategory(cat.name)}
            >
              <div style={styles.categoryIcon}>{cat.icon}</div>
              <div style={styles.categoryName}>{cat.name}</div>
            </div>
          ))}
        </div>

        <label style={styles.label}>Description (Optional)</label>
        <input
          style={styles.input}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Bought groceries and snacks"
        />

        <label style={styles.label}>Amount (₹)</label>
        <input
          style={styles.input}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
        />

        <div style={styles.infoText}>
          Will be split equally between {activeRoommates.length} roommate(s)
        </div>

        <button
          style={{
            ...styles.saveBtn,
            ...(!amount || !category || !paidBy || saving
              ? styles.saveBtnDisabled
              : {}),
          }}
          onClick={saveExpense}
          disabled={!amount || !category || !paidBy || saving}
        >
          {saving ? "Saving..." : "Save Expense"}
        </button>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.historyHeader}>History</div>
        <div>📋</div>
      </div>

      <select
        style={styles.dropdown}
        value={paidByFilter}
        onChange={(e) => setPaidByFilter(e.target.value)}
      >
        <option value="All">All Roommates</option>
        {activeRoommates.map((r) => (
          <option key={r.id} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>

      {paidByFilter !== "All" && (
        <div style={styles.sumCard}>
          <div style={styles.sumLabel}>Total Paid by {paidByFilter}</div>
          <div style={styles.sumAmount}>
            ₹{totalFilteredAmount.toLocaleString("en-IN")}
          </div>
        </div>
      )}

      {filteredExpenses.length === 0 ? (
        <div style={styles.placeholder}>No expenses found</div>
      ) : (
        filteredExpenses.map((exp) => {
          const { icon, bg } = getExpenseIcon(exp.description);
          const splitAmt = exp.amount / exp.splitWith.length;
          return (
            <div key={exp.id} style={styles.expenseItem}>
              <div style={{ ...styles.expenseIcon, backgroundColor: bg }}>
                {icon}
              </div>

              <div style={{ ...styles.expenseInfo, flex: 1 }}>
                {/* SHOW FULL DESCRIPTION LIKE DASHBOARD */}
                <div style={styles.expenseTitle}>{exp.description}</div>
                <div style={styles.expenseSub}>
                  Paid by {exp.paidBy} • Split: ₹{splitAmt.toFixed(0)} each
                </div>
              </div>

              {/* RIGHT SIDE: Amount + Date + Delete in 1 row */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <div style={{ textAlign: "right" }}>
                  <div style={styles.expenseAmount}>
                    ₹{exp.amount.toLocaleString("en-IN")}
                  </div>
                  <div style={styles.expenseSub}>{formatDate(exp.date)}</div>
                </div>

                {/* RED DELETE BUTTON */}
                <button
                  onClick={() => deleteExpense(exp.id)}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: "#fef2f2",
                    color: "#ef4444",
                    border: "none",
                    fontSize: "16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // NEW SETTLEMENT PAGE
  const renderPayment = () => (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.historyHeader}>Settlements</div>
        <div>💳</div>
      </div>

      {/* Summary Card */}
      <div style={styles.paymentSummaryCard}>
        <div style={styles.paymentRow}>
          <div style={styles.paymentLabel}>Total Expense</div>
          <div style={styles.paymentValue}>
            ₹
            {totalExpenses.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
        <div style={styles.paymentRow}>
          <div style={styles.paymentLabel}>Roommates</div>
          <div style={styles.paymentValue}>{totalRoommates}</div>
        </div>
        <div style={styles.paymentRow}>
          <div style={styles.paymentLabel}>Equal Share Per Person</div>
          <div style={styles.paymentValue}>
            ₹{equalShare.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={styles.paymentRow}>
          <div style={styles.paymentLabel}>Needs Total</div>
          <div style={styles.paymentValue}>
            ₹{needsTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Roommate Cards */}
      {roommatePayments.length === 0 ? (
        <div style={styles.placeholder}>Add roommates to see settlements</div>
      ) : (
        roommatePayments.map((r) => (
          <div key={r.name} style={styles.paymentCard}>
            <div style={styles.paymentCardHeader}>
              <div style={styles.paymentCardName}>{r.name}</div>
            </div>
            <div style={styles.paymentCardRow}>
              <div>Paid</div>
              <div>
                ₹{r.paid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={styles.paymentCardRow}>
              <div>Share</div>
              <div>
                ₹{r.share.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div
              style={{
                ...styles.paymentCardRow,
                borderTop: "1px solid #f1f5f9",
                paddingTop: "8px",
              }}
            >
              <div>Balance</div>
              <div
                style={
                  r.balance >= 0
                    ? styles.paymentPositive
                    : styles.paymentNegative
                }
              >
                {r.balance >= 0
                  ? `Gets Back: +₹${r.balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `Needs to Pay: ₹${Math.abs(r.balance).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div style={styles.app}>
      {activeTab === "dashboard" && renderDashboard()}
      {activeTab === "expense" && renderExpense()}
      {activeTab === "history" && renderHistory()}
      {activeTab === "payment" && renderPayment()}

      {/* Add Roommate Modal */}
      {showAddRoommate && (
        <div style={styles.modal} onClick={() => setShowAddRoommate(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Add Roommate</div>
            <input
              style={styles.input}
              value={newRoommate}
              onChange={(e) => setNewRoommate(e.target.value)}
              placeholder="Enter name"
              onKeyPress={(e) => e.key === "Enter" && addRoommate()}
            />
            <div style={styles.modalBtns}>
              <button
                style={{ ...styles.modalBtn, ...styles.cancelBtn }}
                onClick={() => setShowAddRoommate(false)}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.modalBtn, ...styles.confirmBtn }}
                onClick={addRoommate}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div style={styles.modal} onClick={() => setShowDeleteConfirm(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Remove Roommate</div>
            <p
              style={{
                color: "#64748b",
                fontSize: "15px",
                marginBottom: "20px",
              }}
            >
              Are you sure you want to remove <b>{roommateToDelete?.name}</b>?
              This will deactivate them.
            </p>
            <div style={styles.modalBtns}>
              <button
                style={{ ...styles.modalBtn, ...styles.cancelBtn }}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.modalBtn,
                  backgroundColor: "#ef4444",
                  color: "white",
                }}
                onClick={handleDeleteRoommate}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.bottomNav}>
        <div
          style={{
            ...styles.navItem,
            ...(activeTab === "dashboard" ? styles.navItemActive : {}),
          }}
          onClick={() => setActiveTab("dashboard")}
        >
          <div style={styles.navIcon}>🏠</div>
          <div style={styles.navLabel}>Dashboard</div>
        </div>
        <div
          style={{
            ...styles.navItem,
            ...(activeTab === "expense" ? styles.navItemActive : {}),
          }}
          onClick={() => setActiveTab("expense")}
        >
          <div style={styles.navIcon}>💰</div>
          <div style={styles.navLabel}>Expense</div>
        </div>
        <div
          style={{
            ...styles.navItem,
            ...(activeTab === "history" ? styles.navItemActive : {}),
          }}
          onClick={() => setActiveTab("history")}
        >
          <div style={styles.navIcon}>📋</div>
          <div style={styles.navLabel}>History</div>
        </div>
        <div
          style={{
            ...styles.navItem,
            ...(activeTab === "payment" ? styles.navItemActive : {}),
          }}
          onClick={() => setActiveTab("payment")}
        >
          <div style={styles.navIcon}>💳</div>
          <div style={styles.navLabel}>Settlements</div>
        </div>
      </div>
    </div>
  );
}

export default App;
