import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "react-hot-toast";
import logoURL from "../../assets/slt logo.jpg";

const formatDate = (date) => {
  if (!date) return "N/A";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid Date";
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

const getWeeksInMonth = (month, year) => {
  const weeks = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let currentWeekStart = new Date(firstDay);
  if (currentWeekStart.getDay() > 0) {
    currentWeekStart.setDate(
      currentWeekStart.getDate() - currentWeekStart.getDay()
    );
  }

  while (currentWeekStart <= lastDay) {
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

    weeks.push({
      start: new Date(currentWeekStart),
      end: new Date(currentWeekEnd),
      weekNumber: weeks.length + 1,
    });

    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  return weeks;
};

const wasPresentInDateRange = (intern, rangeStart, rangeEnd) => {
  return intern.attendance.some((entry) => {
    const entryDate = new Date(entry.date);
    return (
      entryDate >= rangeStart &&
      entryDate <= rangeEnd &&
      entry.status === "Present"
    );
  });
};

const wasAbsentAllWeekdays = (intern, rangeStart, rangeEnd) => {
  const weekdays = [];
  const current = new Date(rangeStart);

  while (current <= rangeEnd) {
    if (current.getDay() >= 1 && current.getDay() <= 5) {
      weekdays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return weekdays.every((weekday) => {
    return !intern.attendance.some((entry) => {
      const entryDate = new Date(entry.date);
      return (
        entryDate.getDate() === weekday.getDate() &&
        entryDate.getMonth() === weekday.getMonth() &&
        entryDate.getFullYear() === weekday.getFullYear() &&
        entry.status === "Present"
      );
    });
  });
};

export const generatePresentReports = ({ filteredInterns, month, week, year, startDate, endDate }) => {
  if (!month && !week && !startDate) {
    toast.error("Please select a month, week, or date range first");
    return null;
  }

  let rangeStart, rangeEnd;

  if (week && month) {
    const weeks = getWeeksInMonth(parseInt(month), year);
    const selectedWeek = weeks[parseInt(week) - 1];
    if (!selectedWeek) {
      toast.error("Invalid week selection");
      return null;
    }
    rangeStart = selectedWeek.start;
    rangeEnd = selectedWeek.end;
  } else if (startDate && endDate) {
    rangeStart = new Date(startDate);
    rangeEnd = new Date(endDate);
  } else {
    toast.error("Please select either a week or date range");
    return null;
  }

  const presentInterns = filteredInterns.filter((intern) =>
    wasPresentInDateRange(intern, rangeStart, rangeEnd)
  );

  return {
    presentInterns,
    rangeStart,
    rangeEnd,
    month,
    week,
    year,
  };
};

export const exportPresentReport = ({ filteredInterns, month, week, year, startDate, endDate }) => {
  const reports = generatePresentReports({ filteredInterns, month, week, year, startDate, endDate });
  if (!reports) return;

  const ws = XLSX.utils.json_to_sheet(
    reports.presentInterns.map((intern) => ({
      "Trainee ID": intern.Trainee_ID,
      Name: intern.Trainee_Name,
      Specialization: intern.field_of_spec_name,
      Team: intern.team,
      Institute: intern.Institute || "N/A",
      "Start Date": formatDate(intern.Training_StartDate),
      "End Date": formatDate(intern.Training_EndDate),
      Status: "Present",
      "Date Range":
        reports.week && reports.month
          ? `Week ${reports.week} of ${new Date(
              0,
              parseInt(reports.month)
            ).toLocaleString("default", { month: "long" })} ${reports.year}`
          : `${formatDate(reports.rangeStart)} to ${formatDate(reports.rangeEnd)}`,
    }))
  );

  const wscols = [
    { wch: 12 },
    { wch: 25 },
    { wch: 20 },
    { wch: 15 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 30 },
  ];
  ws["!cols"] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Present Interns");
  XLSX.writeFile(wb, "present_interns_report.xlsx");
};

export const exportPresentPDF = ({ filteredInterns, month, week, year, startDate, endDate }) => {
  const reports = generatePresentReports({ filteredInterns, month, week, year, startDate, endDate });
  if (!reports) return;

  try {
    const doc = new jsPDF();
    const marginLeft = 10;
    const marginRight = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginLeft - marginRight;

    doc.setFillColor(248, 249, 250);
    doc.rect(0, 0, pageWidth, 40, "F");

    const logoWidth = 40;
    const logoHeight = 15;
    try {
      doc.addImage(logoURL, "JPEG", marginLeft, 15, logoWidth, logoHeight);
    } catch (error) {
      console.error("Error adding logo:", error);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(70, 70, 70);
    doc.text("Present Interns Report", marginLeft, 50);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    let dateRangeText = "Date Range: ";
    if (reports.month) {
      const monthName = new Date(0, reports.month).toLocaleString("default", {
        month: "long",
      });
      dateRangeText += `${monthName} ${reports.year} (${formatDate(
        reports.rangeStart
      )} - ${formatDate(reports.rangeEnd)})`;
    } else {
      dateRangeText += `${formatDate(reports.rangeStart)} - ${formatDate(
        reports.rangeEnd
      )}`;
    }
    doc.text(dateRangeText, marginLeft, 60);

    doc.text(
      `Total present interns: ${reports.presentInterns.length}`,
      marginLeft,
      70
    );

    const tableData = reports.presentInterns.map((intern) => [
      intern.Trainee_ID || "",
      intern.Trainee_Name || "",
      intern.field_of_spec_name || "",
      intern.Institute || "N/A",
      "Present",
    ]);

    const headers = [
      "Trainee ID",
      "Name",
      "Specialization",
      "Institute",
      "Status",
    ];

    doc.autoTable({
      head: [headers],
      body: tableData,
      startY: 80,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [25, 135, 84],
        textColor: 255,
        fontStyle: "bold",
      },
      margin: { left: marginLeft, right: marginLeft },
      tableWidth: contentWidth,
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        {
          align: "center",
        }
      );
    }

    doc.save("Present_Interns_Report.pdf");
  } catch (error) {
    console.error("Error generating present PDF:", error);
    toast.error("Failed to generate present report");
  }
};

export const generateAbsentReports = ({ filteredInterns, month, week, year, startDate, endDate }) => {
  if (!month && !week && !startDate) {
    toast.error("Please select a month, week, or date range first");
    return null;
  }

  let rangeStart, rangeEnd;

  if (week && month) {
    const weeks = getWeeksInMonth(parseInt(month), year);
    const selectedWeek = weeks[parseInt(week) - 1];
    if (!selectedWeek) {
      toast.error("Invalid week selection");
      return null;
    }
    rangeStart = selectedWeek.start;
    rangeEnd = selectedWeek.end;
  } else if (startDate && endDate) {
    rangeStart = new Date(startDate);
    rangeEnd = new Date(endDate);
  } else {
    toast.error("Please select either a week or date range");
    return null;
  }

  const absentInterns = [];
  const absentAllWeekdaysInterns = [];

  filteredInterns.forEach((intern) => {
    const isPresent = wasPresentInDateRange(intern, rangeStart, rangeEnd);

    if (!isPresent) {
      absentInterns.push(intern);
      const isAbsentAllWeekdays = wasAbsentAllWeekdays(
        intern,
        rangeStart,
        rangeEnd
      );
      if (isAbsentAllWeekdays) {
        absentAllWeekdaysInterns.push(intern);
      }
    }
  });

  return {
    absentInterns,
    absentAllWeekdaysInterns,
    rangeStart,
    rangeEnd,
    month,
    week,
    year,
  };
};

export const exportAbsentReport = ({ filteredInterns, month, week, year, startDate, endDate }) => {
  const reports = generateAbsentReports({ filteredInterns, month, week, year, startDate, endDate });
  if (!reports) return;

  const ws = XLSX.utils.json_to_sheet(
    reports.absentInterns.map((intern) => ({
      "Trainee ID": intern.Trainee_ID,
      Name: intern.Trainee_Name,
      Specialization: intern.field_of_spec_name,
      Team: intern.team,
      Institute: intern.Institute || "N/A",
      "Start Date": formatDate(intern.Training_StartDate),
      "End Date": formatDate(intern.Training_EndDate),
      Status: "Absent",
      "Absent Entire Week": reports.absentAllWeekdaysInterns.some(
        (i) => i._id === intern._id
      )
        ? "Yes"
        : "No",
      "Date Range":
        reports.week && reports.month
          ? `Week ${reports.week} of ${new Date(
              0,
              parseInt(reports.month)
            ).toLocaleString("default", { month: "long" })} ${reports.year}`
          : `${formatDate(reports.rangeStart)} to ${formatDate(reports.rangeEnd)}`,
    }))
  );

  const wscols = [
    { wch: 12 },
    { wch: 25 },
    { wch: 20 },
    { wch: 15 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 18 },
    { wch: 30 },
  ];
  ws["!cols"] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Absent Interns");
  XLSX.writeFile(wb, "absent_interns_report.xlsx");
};

export const exportAbsentPDF = ({ filteredInterns, month, week, year, startDate, endDate }) => {
  const reports = generateAbsentReports({ filteredInterns, month, week, year, startDate, endDate });
  if (!reports) return;

  try {
    const doc = new jsPDF();
    const marginLeft = 10;
    const marginRight = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - marginLeft - marginRight;

    doc.setFillColor(248, 249, 250);
    doc.rect(0, 0, pageWidth, 40, "F");

    const logoWidth = 40;
    const logoHeight = 15;
    try {
      doc.addImage(logoURL, "JPEG", marginLeft, 15, logoWidth, logoHeight);
    } catch (error) {
      console.error("Error adding logo:", error);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(70, 70, 70);
    doc.text("Absent Interns Report", marginLeft, 50);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    let dateRangeText = "Date Range: ";
    if (reports.month) {
      const monthName = new Date(0, reports.month).toLocaleString("default", {
        month: "long",
      });
      dateRangeText += `${monthName} ${reports.year} (${formatDate(
        reports.rangeStart
      )} - ${formatDate(reports.rangeEnd)})`;
    } else {
      dateRangeText += `${formatDate(reports.rangeStart)} - ${formatDate(
        reports.rangeEnd
      )}`;
    }
    doc.text(dateRangeText, marginLeft, 60);

    doc.text(
      `Total absent interns: ${reports.absentInterns.length}`,
      marginLeft,
      70
    );
    doc.text(
      `Interns absent entire work week (Mon-Fri): ${reports.absentAllWeekdaysInterns.length}`,
      marginLeft,
      80
    );

    const tableData = reports.absentInterns.map((intern) => [
      intern.Trainee_ID || "",
      intern.Trainee_Name || "",
      intern.field_of_spec_name || "",
      intern.Institute || "N/A",
      "Absent",
      reports.absentAllWeekdaysInterns.some((i) => i._id === intern._id)
        ? "Yes"
        : "No",
    ]);

    const headers = [
      "Trainee ID",
      "Name",
      "Specialization",
      "Institute",
      "Status",
      "Absent Entire Week",
    ];

    doc.autoTable({
      head: [headers],
      body: tableData,
      startY: 90,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [220, 53, 69],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        5: {
          cellWidth: "auto",
          halign: "center",
        },
      },
      margin: { left: marginLeft, right: marginLeft },
      tableWidth: contentWidth,
      didDrawCell: (data) => {
        if (data.column.index === 5 && data.cell.raw === "Yes") {
          doc.setFillColor(255, 243, 205);
          doc.rect(
            data.cell.x,
            data.cell.y,
            data.cell.width,
            data.cell.height,
            "F"
          );
          doc.setTextColor(255, 0, 0);
          doc.text(
            data.cell.raw,
            data.cell.x + data.cell.width / 2,
            data.cell.y + data.cell.height / 2 + 2,
            {
              align: "center",
            }
          );
          return true;
        }
      },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        {
          align: "center",
        }
      );
    }

    doc.save("Absent_Interns_Report.pdf");
  } catch (error) {
    console.error("Error generating absent PDF:", error);
    toast.error("Failed to generate absent report");
  }
};