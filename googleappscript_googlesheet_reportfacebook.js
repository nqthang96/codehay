function getFacebookAdsReport() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = spreadsheet.getSheetByName("data");
  var reportSheet = spreadsheet.getSheetByName("report");

  var adAccountRange = dataSheet.getRange("B2:B" + dataSheet.getLastRow());
  var adAccounts = adAccountRange.getValues();
  var accessTokenRange = dataSheet.getRange("G2:G" + dataSheet.getLastRow());
  var accessTokens = accessTokenRange.getValues();

  var date = dataSheet.getRange("C2").getValue();
  var usdExchangeRate = dataSheet.getRange("E2").getValue();
  var phpExchangeRate = dataSheet.getRange("F2").getValue();

  for (var i = 0; i < adAccounts.length; i++) {
    var adAccount = adAccounts[i][0];
    var accessToken = accessTokens[i][0];

    var apiUrl = "https://graph.facebook.com/v17.0/act_" + encodeURIComponent(adAccount) + "/insights?access_token=" + encodeURIComponent(accessToken) + "&fields=account_name,spend,account_currency,actions.action_type(comment)&time_range[since]=" + encodeURIComponent(date) + "&time_range[until]=" + encodeURIComponent(date);

    var response = UrlFetchApp.fetch(apiUrl);
    var data = JSON.parse(response.getContentText());
    var reports = data.data;

    var lastReportRow = reportSheet.getLastRow();

    for (var j = 0; j < reports.length; j++) {
      var report = reports[j];
      var accountName = report.account_name;
      var spend = report.spend;
      var currency = report.account_currency;

      // Kiểm tra currency và tính toán spend dựa trên giá trị tương ứng
      var spendValue = spend;
      if (currency === "PHP") {
        spendValue *= phpExchangeRate;
      } else if (currency === "USD") {
        spendValue *= usdExchangeRate;
      }

      // Làm tròn và chuyển đổi thành số nguyên
      spendValue = parseInt(Math.round(spendValue));

      // Lấy giá trị commentValue và messagingReplyValue
      var commentValue = 0;
      var messagingReplyValue = 0;

      if (report.actions) {
        var commentAction = report.actions.find(action => action.action_type === "comment");
        var messagingReplyAction = report.actions.find(action => action.action_type === "onsite_conversion.messaging_first_reply");

        if (commentAction) {
          commentValue = commentAction.value;
        }

        if (messagingReplyAction) {
          messagingReplyValue = messagingReplyAction.value;
        }
      }

      // Ghi dữ liệu vào dòng tiếp theo trống trong sheet "report"
      reportSheet.getRange(lastReportRow + 1 + j, 5).setValue(accountName);
      reportSheet.getRange(lastReportRow + 1 + j, 2).setValue(spendValue);
      reportSheet.getRange(lastReportRow + 1 + j, 7).setValue(currency);
      reportSheet.getRange(lastReportRow + 1 + j, 1).setValue(date);
      reportSheet.getRange(lastReportRow + 1 + j, 6).setValue(adAccount);
      reportSheet.getRange(lastReportRow + 1 +j, 3).setValue(commentValue);
      reportSheet.getRange(lastReportRow + 1 + j, 4).setValue(messagingReplyValue);
    }

    lastReportRow += reports.length;
  }
}

