function main() {
  var spreadsheetId = "1fgdbsoKL1GM_ayjQuYWlJgDDztoPrtWGDDEVSFhsjtI"; // ID của Google Sheet
  var sheetName = "test"; // Tên của Sheet trong Google Sheet
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); // Lấy ngày hôm qua

  var formattedYesterday = Utilities.formatDate(yesterday, "GMT", "yyyy-MM-dd");
  var accountname = "nqt3_thailan_ecomres";

  // Lấy báo cáo từ Google Ads
  var report = AdsApp.report("SELECT CampaignName, Clicks, Impressions, Cost, TopImpressionPercentage, AbsoluteTopImpressionPercentage, Conversions " +
    "FROM CAMPAIGN_PERFORMANCE_REPORT " +
    "WHERE Date = '" + formattedYesterday + "' AND CampaignName CONTAINS 'ecomres' AND Impressions > 0");

  // Tạo một mảng chứa dữ liệu báo cáo
  var reportData = [];

  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    var campaignName = row["CampaignName"];
    var costString = row["Cost"];
    var cost = parseFloat(costString.replace(/,/g, ""));
    var clicks = row["Clicks"];
    var impressions = row["Impressions"];
    var top = parseFloat(row["TopImpressionPercentage"]);
    var top1 = parseFloat(row["AbsoluteTopImpressionPercentage"]);
    var data = parseFloat(row["Conversions"]);

    reportData.push([formattedYesterday, campaignName, accountname, cost, clicks, impressions, top, top1, data]);
  }

  // Mở Spreadsheet và Sheet
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName(sheetName);

  // Xác định dòng cuối cùng có dữ liệu trong Sheet
  var lastRow = sheet.getLastRow();

  // Ghi dữ liệu báo cáo vào dòng tiếp theo sau dòng cuối cùng, chỉ khi có dữ liệu trong mảng reportData
  if (reportData.length > 0) {
    sheet.getRange(lastRow + 1, 1, reportData.length, reportData[0].length).setValues(reportData);
  }
}
