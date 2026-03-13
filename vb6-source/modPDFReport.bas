Attribute VB_Name = "modPDFReport"
'================================================================================
' modPDFReport.bas (Module ใหม่)
' Purpose: Generate PDF Report สำหรับผลการออกแบบ
' Note: ใช้ HTML → Print to PDF (Microsoft Print to PDF)
'================================================================================

Option Explicit

'================================================================================
' Sub: GeneratePDFReport
' Purpose: สร้าง PDF Report ของผลการออกแบบ
'================================================================================
Public Sub GeneratePDFReport(D As Design, Cost As Double, Iteration As Long, _
                            FS_OT As Double, FS_SL As Double, FS_BC As Double, _
                            e As Double, QMax As Double, _
                            H As Double, H1 As Double, mu As Double, _
                            phi As Double, qa As Double, _
                            fc As Double, fy As Double, gamma_c As Double, gamma_soil As Double)
    
    On Error GoTo ErrorHandler
    
    ' สร้าง HTML Report
    Dim htmlContent As String
    htmlContent = GenerateHTMLReport(D, Cost, Iteration, _
                                    FS_OT, FS_SL, FS_BC, e, QMax, _
                                    H, H1, mu, phi, qa, fc, fy, gamma_c, gamma_soil)
    
    ' บันทึก HTML ไปที่ Temp folder
    Dim htmlPath As String
    htmlPath = Environ("TEMP") & "\RC_RT_HCA_Report_" & Format(Now, "yyyymmdd_hhnnss") & ".html"
    
    Dim fileNum As Integer
    fileNum = FreeFile
    Open htmlPath For Output As #fileNum
    Print #fileNum, htmlContent
    Close #fileNum
    
    ' เปิด HTML ด้วย Browser (User สามารถ Print to PDF)
    Shell "explorer.exe " & htmlPath, vbNormalFocus
    
    MsgBox "HTML Report generated!" & vbCrLf & vbCrLf & _
           "Location: " & htmlPath & vbCrLf & vbCrLf & _
           "Please use your browser to Print → Save as PDF", _
           vbInformation, "Generate PDF Report"
    
    Exit Sub

ErrorHandler:
    MsgBox "Error generating PDF report: " & Err.Description, vbCritical
End Sub

'================================================================================
' Function: GenerateHTMLReport
' Purpose: สร้างเนื้อหา HTML สำหรับ Report
'================================================================================
Private Function GenerateHTMLReport(D As Design, Cost As Double, Iteration As Long, _
                                   FS_OT As Double, FS_SL As Double, FS_BC As Double, _
                                   e As Double, QMax As Double, _
                                   H As Double, H1 As Double, mu As Double, _
                                   phi As Double, qa As Double, _
                                   fc As Double, fy As Double, _
                                   gamma_c As Double, gamma_soil As Double) As String
    
    Dim html As String
    
    html = "<!DOCTYPE html>" & vbCrLf
    html = html & "<html lang='th'>" & vbCrLf
    html = html & "<head>" & vbCrLf
    html = html & "  <meta charset='UTF-8'>" & vbCrLf
    html = html & "  <title>RC_RT_HCA - Design Report</title>" & vbCrLf
    html = html & "  <style>" & vbCrLf
    html = html & "    body { font-family: 'Cordia New', 'CordiaUPC', 'Arial', sans-serif; margin: 40px; font-size: 18pt; }" & vbCrLf
    html = html & "    h1 { color: #2c3e50; text-align: center; border-bottom: 3px solid #3498db; padding-bottom: 10px; font-size: 28pt; }" & vbCrLf
    html = html & "    h2 { color: #34495e; margin-top: 30px; border-left: 5px solid #3498db; padding-left: 15px; font-size: 22pt; }" & vbCrLf
    html = html & "    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 18pt; }" & vbCrLf
    html = html & "    th { background-color: #3498db; color: white; padding: 12px; text-align: left; font-size: 20pt; }" & vbCrLf
    html = html & "    td { padding: 10px; border-bottom: 1px solid #ddd; }" & vbCrLf
    html = html & "    tr:hover { background-color: #f5f5f5; }" & vbCrLf
    html = html & "    .pass { color: green; font-weight: bold; }" & vbCrLf
    html = html & "    .fail { color: red; font-weight: bold; }" & vbCrLf
    html = html & "    .highlight { background-color: #fff9c4; }" & vbCrLf
    html = html & "    .footer { text-align: center; margin-top: 50px; color: #7f8c8d; font-size: 16pt; }" & vbCrLf
    html = html & "  </style>" & vbCrLf
    html = html & "</head>" & vbCrLf
    html = html & "<body>" & vbCrLf
    
    ' หัวเรื่อง
    html = html & "  <h1>RC_RT_HCA - Reinforced Concrete Retaining Wall Design Report</h1>" & vbCrLf
    html = html & "  <p style='text-align:center;'>Hill Climbing Algorithm Optimization</p>" & vbCrLf
    html = html & "  <p style='text-align:center;'>Generated: " & Format(Now, "dd/mm/yyyy hh:nn:ss") & "</p>" & vbCrLf
    
    ' 1. Input Parameters
    html = html & "  <h2>1. Input Parameters</h2>" & vbCrLf
    html = html & "  <table>" & vbCrLf
    html = html & "    <tr><th>Parameter</th><th>Value</th><th>Unit</th></tr>" & vbCrLf
    html = html & "    <tr><td>Wall Height (H)</td><td>" & Format(H, "0.00") & "</td><td>m</td></tr>" & vbCrLf
    html = html & "    <tr><td>Backfill Height (H1)</td><td>" & Format(H1, "0.00") & "</td><td>m</td></tr>" & vbCrLf
    html = html & "    <tr><td>Friction Coefficient (μ)</td><td>" & Format(mu, "0.00") & "</td><td>-</td></tr>" & vbCrLf
    html = html & "    <tr><td>Internal Friction Angle (φ)</td><td>" & Format(phi, "0") & "</td><td>°</td></tr>" & vbCrLf
    html = html & "    <tr><td>Allowable Bearing Capacity (qa)</td><td>" & Format(qa, "0.00") & "</td><td>ton/m²</td></tr>" & vbCrLf
    html = html & "    <tr><td>Soil Unit Weight (γsoil)</td><td>" & Format(gamma_soil, "0.00") & "</td><td>ton/m³</td></tr>" & vbCrLf
    html = html & "    <tr><td>Concrete Unit Weight (γc)</td><td>" & Format(gamma_c, "0.00") & "</td><td>ton/m³</td></tr>" & vbCrLf
    html = html & "    <tr><td>Concrete Strength (f'c)</td><td>" & Format(fc, "0") & "</td><td>ksc</td></tr>" & vbCrLf
    html = html & "    <tr><td>Steel Yield Strength (fy)</td><td>" & Format(fy, "0") & "</td><td>ksc (SD40)</td></tr>" & vbCrLf
    html = html & "  </table>" & vbCrLf
    
    ' 2. Optimized Design
    html = html & "  <h2>2. Optimized Design Results</h2>" & vbCrLf
    html = html & "  <table>" & vbCrLf
    html = html & "    <tr class='highlight'><th>Item</th><th>Value</th><th>Unit</th></tr>" & vbCrLf
    html = html & "    <tr class='highlight'><td><b>Total Cost</b></td><td><b>" & Format(Cost, "#,##0.00") & "</b></td><td><b>Baht/m</b></td></tr>" & vbCrLf
    html = html & "    <tr class='highlight'><td><b>Found at Iteration</b></td><td><b>" & Format(Iteration, "#,##0") & "</b></td><td>-</td></tr>" & vbCrLf
    html = html & "  </table>" & vbCrLf
    
    ' 3. Dimensions
    html = html & "  <h2>3. Dimensions</h2>" & vbCrLf
    html = html & "  <table>" & vbCrLf
    html = html & "    <tr><th>Component</th><th>Value</th><th>Unit</th></tr>" & vbCrLf
    html = html & "    <tr><td>Stem Top Thickness (tt)</td><td>" & Format(D.tt, "0.000") & "</td><td>m</td></tr>" & vbCrLf
    html = html & "    <tr><td>Stem Bottom Thickness (tb)</td><td>" & Format(D.tb, "0.000") & "</td><td>m</td></tr>" & vbCrLf
    html = html & "    <tr><td>Toe Length (Ltoe)</td><td>" & Format(D.Ltoe, "0.000") & "</td><td>m</td></tr>" & vbCrLf
    html = html & "    <tr><td>Base Width (B)</td><td>" & Format(D.Base, "0.000") & "</td><td>m</td></tr>" & vbCrLf
    html = html & "    <tr><td>Base Thickness (h1)</td><td>" & Format(D.H1, "0.000") & "</td><td>m</td></tr>" & vbCrLf
    html = html & "  </table>" & vbCrLf
    
    ' 4. Reinforcement
    html = html & "  <h2>4. Reinforcement</h2>" & vbCrLf
    html = html & "  <table>" & vbCrLf
    html = html & "    <tr><th>Location</th><th>Bar Size</th><th>Spacing</th><th>Area (As)</th></tr>" & vbCrLf
    html = html & "    <tr><td>Stem</td><td>DB" & DBArray(D.ASst_DB) & "</td><td>@" & SPArray(D.ASst_Sp) & " mm</td><td>" & Format(modCost.CalculateAsFromArray(D.ASst_DB, D.ASst_Sp), "0") & " mm²/m</td></tr>" & vbCrLf
    html = html & "    <tr><td>Toe</td><td>DB" & DBArray(D.AStoe_DB) & "</td><td>@" & SPArray(D.AStoe_Sp) & " mm</td><td>" & Format(modCost.CalculateAsFromArray(D.AStoe_DB, D.AStoe_Sp), "0") & " mm²/m</td></tr>" & vbCrLf
    html = html & "    <tr><td>Heel</td><td>DB" & DBArray(D.ASheel_DB) & "</td><td>@" & SPArray(D.ASheel_Sp) & " mm</td><td>" & Format(modCost.CalculateAsFromArray(D.ASheel_DB, D.ASheel_Sp), "0") & " mm²/m</td></tr>" & vbCrLf
    html = html & "  </table>" & vbCrLf
    
    ' 5. Safety Factors
    html = html & "  <h2>5. Safety Factors</h2>" & vbCrLf
    html = html & "  <table>" & vbCrLf
    html = html & "    <tr><th>Check</th><th>Value</th><th>Required</th><th>Status</th></tr>" & vbCrLf
    html = html & "    <tr><td>Overturning (FS_OT)</td><td>" & Format(FS_OT, "0.00") & "</td><td>≥ 2.0</td><td class='" & IIf(FS_OT >= 2, "pass", "fail") & "'>" & IIf(FS_OT >= 2, "PASS", "FAIL") & "</td></tr>" & vbCrLf
    html = html & "    <tr><td>Sliding (FS_SL)</td><td>" & Format(FS_SL, "0.00") & "</td><td>≥ 1.5</td><td class='" & IIf(FS_SL >= 1.5, "pass", "fail") & "'>" & IIf(FS_SL >= 1.5, "PASS", "FAIL") & "</td></tr>" & vbCrLf
    html = html & "    <tr><td>Bearing Capacity (FS_BC)</td><td>" & Format(FS_BC, "0.00") & "</td><td>≥ 2.5</td><td class='" & IIf(FS_BC >= 2.5, "pass", "fail") & "'>" & IIf(FS_BC >= 2.5, "PASS", "FAIL") & "</td></tr>" & vbCrLf
    html = html & "    <tr><td>Eccentricity (e)</td><td>" & Format(e, "0.000") & " m</td><td>≤ B/6 = " & Format(D.Base / 6, "0.000") & " m</td><td class='" & IIf(e <= D.Base / 6, "pass", "fail") & "'>" & IIf(e <= D.Base / 6, "PASS", "FAIL") & "</td></tr>" & vbCrLf
    html = html & "    <tr><td>Maximum Bearing Pressure (QMax)</td><td>" & Format(QMax, "0.00") & " ton/m²</td><td>≤ " & Format(qa, "0.00") & " ton/m²</td><td class='" & IIf(QMax <= qa, "pass", "fail") & "'>" & IIf(QMax <= qa, "PASS", "FAIL") & "</td></tr>" & vbCrLf
    html = html & "  </table>" & vbCrLf
    
    ' Footer
    html = html & "  <div class='footer'>" & vbCrLf
    html = html & "    <p>RC_RT_HCA v2.0 - Reinforced Concrete Retaining Wall Design (Hill Climbing Algorithm)</p>" & vbCrLf
    html = html & "    <p>Design Standard: วสท. 2562, ACI 318-19</p>" & vbCrLf
    html = html & "  </div>" & vbCrLf
    
    html = html & "</body>" & vbCrLf
    html = html & "</html>" & vbCrLf
    
    GenerateHTMLReport = html
End Function
