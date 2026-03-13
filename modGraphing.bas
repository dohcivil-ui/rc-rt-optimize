Attribute VB_Name = "modGraphing"
Option Explicit

' ========================================
' Graphing Module
' RC_RT_HCA v2.0 - FIXED VERSION
' ========================================

' ========================================
' Draw Cost Reduction Graph
' ========================================
Public Sub DrawCostGraph(pic As PictureBox, CostHistory() As Double, BestIteration As Long)
    Dim i As Long
    Dim maxIter As Long
    Dim minCost As Double
    Dim maxCost As Double
    Dim xScale As Double
    Dim yScale As Double
    Dim x1 As Single, y1 As Single
    Dim x2 As Single, y2 As Single
    Dim margin As Single
    Dim graphWidth As Single
    Dim graphHeight As Single
    
    ' Clear picture box
    pic.Cls
    pic.AutoRedraw = True
    
    ' Check if data exists
    maxIter = UBound(CostHistory)
    If maxIter < 1 Then Exit Sub
    
    ' Set margins
    margin = 600
    graphWidth = pic.ScaleWidth - (2 * margin)
    graphHeight = pic.ScaleHeight - (2 * margin)
    
    ' ? Find min and max costs (กรองเฉพาะค่าผิดปกติ 999,000+)
    minCost = 999999999#
    maxCost = 0
    
    For i = 1 To maxIter
        ' กรองเฉพาะค่าผิดปกติ (>= 999,000)
        If CostHistory(i) > 0 And CostHistory(i) < 999000 Then
            If CostHistory(i) < minCost Then minCost = CostHistory(i)
            If CostHistory(i) > maxCost Then maxCost = CostHistory(i)
        End If
    Next i
    
    ' ถ้าไม่เจอค่าที่ถูกต้องเลย ให้ใช้ค่า default
    If minCost = 999999999# Then minCost = 0
    If maxCost = 0 Then maxCost = 10000
    
    ' Add padding to y-axis
    Dim yPadding As Double
    yPadding = (maxCost - minCost) * 0.1
    If yPadding = 0 Then yPadding = 100
    minCost = minCost - yPadding
    maxCost = maxCost + yPadding
    
    ' ป้องกัน minCost ติดลบ
    If minCost < 0 Then minCost = 0
    
    ' Calculate scales
    xScale = graphWidth / maxIter
    If maxCost > minCost Then
        yScale = graphHeight / (maxCost - minCost)
    Else
        yScale = 1
    End If
    
    ' === Draw Axes ===
    pic.DrawWidth = 2
    pic.ForeColor = RGB(0, 0, 0)
    
    ' Y-axis
    pic.Line (margin, margin)-(margin, pic.ScaleHeight - margin)
    
    ' X-axis
    pic.Line (margin, pic.ScaleHeight - margin)-(pic.ScaleWidth - margin, pic.ScaleHeight - margin)
    
    ' === Draw Grid Lines (Optional) ===
    pic.DrawStyle = 2  ' Dotted line
    pic.DrawWidth = 1
    pic.ForeColor = RGB(220, 220, 220)
    
    ' Horizontal grid lines (5 lines)
    Dim gridStep As Single
    gridStep = graphHeight / 5
    For i = 1 To 4
        y1 = margin + (i * gridStep)
        pic.Line (margin, y1)-(pic.ScaleWidth - margin, y1)
    Next i
    
    ' Reset DrawStyle to solid for subsequent drawings
    pic.DrawStyle = 0  ' Solid line
    
    ' === Draw Cost History (Step/Staircase Graph) ===
    pic.DrawWidth = 2
    pic.ForeColor = RGB(0, 100, 255)  ' Blue line
    
    For i = 1 To maxIter - 1
        ' ? วาดทุกจุดที่ไม่ใช่ค่าผิดปกติ (999,000+)
        If CostHistory(i) > 0 And CostHistory(i) < 999000 And _
           CostHistory(i + 1) > 0 And CostHistory(i + 1) < 999000 Then
            
            ' Calculate coordinates
            x1 = margin + ((i - 1) * xScale)
            y1 = (pic.ScaleHeight - margin) - ((CostHistory(i) - minCost) * yScale)
            
            x2 = margin + (i * xScale)
            y2 = (pic.ScaleHeight - margin) - ((CostHistory(i + 1) - minCost) * yScale)
            
            ' Draw horizontal line (step)
            pic.Line (x1, y1)-(x2, y1)
            
            ' Draw vertical line (drop) only if cost changed
            If CostHistory(i) <> CostHistory(i + 1) Then
                pic.Line (x2, y1)-(x2, y2)
            End If
        End If
    Next i
    
    ' === Mark Best Cost Point ===
    If BestIteration > 0 And BestIteration <= maxIter Then
        Dim bestX As Single
        Dim bestY As Single
        Dim bestCost As Double
        
        bestCost = CostHistory(BestIteration)
        
        ' ? วาดเฉพาะถ้ามีค่าที่ถูกต้อง
        If bestCost > 0 And bestCost < 999000 Then
            bestX = margin + ((BestIteration - 1) * xScale)
            bestY = (pic.ScaleHeight - margin) - ((bestCost - minCost) * yScale)
            
            ' Draw red circle at best point
            pic.FillStyle = 0  ' Solid
            pic.FillColor = RGB(255, 0, 0)
            pic.Circle (bestX, bestY), 80, RGB(255, 0, 0)
            
            ' Draw label
            pic.ForeColor = RGB(255, 0, 0)
            pic.FontSize = 18  ' เพิ่มจาก 9 เป็น 18
            pic.FontBold = True
            pic.CurrentX = bestX + 150
            pic.CurrentY = bestY - 100
            pic.Print "Best: " & Format(bestCost, "#,##0") & " ฿"
        End If
    End If
    
    ' === Draw Axis Labels ===
    pic.ForeColor = RGB(0, 0, 0)
    pic.FontSize = 20  ' เพิ่มจาก 10 เป็น 20
    pic.FontBold = True
    
    ' Y-axis label (Cost)
    pic.CurrentX = margin - 500
    pic.CurrentY = margin - 300
    pic.Print "Cost (Baht/m)"
    
    ' X-axis label (Iteration)
    pic.CurrentX = pic.ScaleWidth / 2 - 500
    pic.CurrentY = pic.ScaleHeight - margin + 300
    pic.Print "Iteration"
    
    ' === Draw Y-axis Scale ===
    pic.FontSize = 16  ' เพิ่มจาก 8 เป็น 16
    pic.FontBold = False
    
    ' Max cost
    pic.CurrentX = 50
    pic.CurrentY = margin - 50
    pic.Print Format(maxCost, "#,##0")
    
    ' Min cost
    pic.CurrentX = 50
    pic.CurrentY = pic.ScaleHeight - margin - 50
    pic.Print Format(minCost, "#,##0")
    
    ' Middle value
    Dim midCost As Double
    midCost = (maxCost + minCost) / 2
    pic.CurrentX = 50
    pic.CurrentY = (margin + (pic.ScaleHeight - margin)) / 2 - 50
    pic.Print Format(midCost, "#,##0")
    
    ' === Draw X-axis Scale ===
    pic.FontSize = 16  ' เพิ่มจาก 8 เป็น 16 (ยังคงจากด้านบน)
    
    ' Start
    pic.CurrentX = margin - 50
    pic.CurrentY = pic.ScaleHeight - margin + 100
    pic.Print "0"
    
    ' End
    pic.CurrentX = pic.ScaleWidth - margin - 200
    pic.CurrentY = pic.ScaleHeight - margin + 100
    pic.Print Format(maxIter, "#,##0")
    
    ' Middle
    pic.CurrentX = (margin + (pic.ScaleWidth - margin)) / 2 - 200
    pic.CurrentY = pic.ScaleHeight - margin + 100
    pic.Print Format(maxIter / 2, "#,##0")
    
    ' Refresh
    pic.Refresh
End Sub

' ========================================
' Clear Graph
' ========================================
Public Sub ClearGraph(pic As PictureBox)
    pic.Cls
    pic.Refresh
End Sub


