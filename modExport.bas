Attribute VB_Name = "modExport"
'================================================================================
' Module: modExport
' Purpose: Export CSV files for RC_RT_HCA results
' Files: accept-HCA.csv, graph-HCA.csv, loopPrice-HCA.csv
' Location: D:\RC_Result\
'================================================================================

Option Explicit

' Global variables for export
Public ExportFolderPath As String

'================================================================================
' Function: InitializeExportFolder
' Purpose: สร้างโฟลเดอร์ D:\RC_Result\ ถ้ายังไม่มี
' Returns: True if successful, False if error
'================================================================================
Public Function InitializeExportFolder() As Boolean
    On Error GoTo ErrorHandler
    
    ExportFolderPath = "D:\RC_Result\"
    
    ' ตรวจสอบและสร้างโฟลเดอร์
    If Dir(ExportFolderPath, vbDirectory) = "" Then
        MkDir ExportFolderPath
    End If
    
    InitializeExportFolder = True
    Exit Function
    
ErrorHandler:
    MsgBox "Error creating folder: " & ExportFolderPath & vbCrLf & _
           "Error: " & Err.Description, vbCritical, "Export Error"
    InitializeExportFolder = False
End Function

'================================================================================
' Sub: ExportAcceptHCA
' Purpose: Export accept-HCA.csv (4 columns)
' Columns: No., Rejected, Passed, Passed and Better
'================================================================================
Public Sub ExportAcceptHCA(AcceptData() As AcceptRecord, TotalRecords As Long)
    Dim fileNum As Integer
    Dim filePath As String
    Dim i As Long
    
    On Error GoTo ErrorHandler
    
    ' สร้างโฟลเดอร์ถ้ายังไม่มี
    If Not InitializeExportFolder() Then Exit Sub
    
    ' เปิดไฟล์
    fileNum = FreeFile
    filePath = ExportFolderPath & "accept-HCA.csv"
    Open filePath For Output As #fileNum
    
    ' เขียน Header
    Print #fileNum, "No.,Rejected,Passed,Passed and Better"
    
    ' เขียนข้อมูล
    For i = 1 To TotalRecords
        With AcceptData(i)
            ' Format: No., Rejected, , Passed and Better
            Print #fileNum, .IterationNo & "," & .RejectedPrice & ",," & .BestPrice
        End With
    Next i
    
    ' ปิดไฟล์
    Close #fileNum
    
    Exit Sub
    
ErrorHandler:
    If fileNum > 0 Then Close #fileNum
    MsgBox "Error exporting accept-HCA.csv: " & Err.Description, vbCritical
End Sub

'================================================================================
' Sub: ExportGraphHCA
' Purpose: Export graph-HCA.csv (2 columns, NO HEADER)
' Columns: Iteration, BestCost
'================================================================================
Public Sub ExportGraphHCA(GraphData() As GraphRecord, TotalRecords As Long)
    Dim fileNum As Integer
    Dim filePath As String
    Dim i As Long
    
    On Error GoTo ErrorHandler
    
    ' สร้างโฟลเดอร์ถ้ายังไม่มี
    If Not InitializeExportFolder() Then Exit Sub
    
    ' เปิดไฟล์
    fileNum = FreeFile
    filePath = ExportFolderPath & "graph-HCA.csv"
    Open filePath For Output As #fileNum
    
    ' ไม่มี Header - เขียนข้อมูลเลย
    For i = 1 To TotalRecords
        With GraphData(i)
            ' Format: Iteration,BestCost
            Print #fileNum, .IterationNo & "," & Format(.BestCost, "0.00000000000000")
        End With
    Next i
    
    ' ปิดไฟล์
    Close #fileNum
    
    Exit Sub
    
ErrorHandler:
    If fileNum > 0 Then Close #fileNum
    MsgBox "Error exporting graph-HCA.csv: " & Err.Description, vbCritical
End Sub

'================================================================================
' Sub: ExportLoopPriceHCA
' Purpose: Export loopPrice-HCA.csv (3 columns)
' Columns: No., Loop, BestPrice
'================================================================================
Public Sub ExportLoopPriceHCA(LoopData() As LoopRecord, TotalTrials As Long)
    Dim fileNum As Integer
    Dim filePath As String
    Dim i As Long
    
    On Error GoTo ErrorHandler
    
    ' สร้างโฟลเดอร์ถ้ายังไม่มี
    If Not InitializeExportFolder() Then Exit Sub
    
    ' เปิดไฟล์
    fileNum = FreeFile
    filePath = ExportFolderPath & "loopPrice-HCA.csv"
    Open filePath For Output As #fileNum
    
    ' เขียน Header
    Print #fileNum, "No.,Loop,BestPrice"
    
    ' เขียนข้อมูล
    For i = 1 To TotalTrials
        With LoopData(i)
            ' Format: No., Loop, BestPrice
            Print #fileNum, .TrialNo & "," & .BestIteration & "," & Format(.BestPrice, "0.000000000000")
        End With
    Next i
    
    ' ปิดไฟล์
    Close #fileNum
    
    Exit Sub
    
ErrorHandler:
    If fileNum > 0 Then Close #fileNum
    MsgBox "Error exporting loopPrice-HCA.csv: " & Err.Description, vbCritical
End Sub

'================================================================================
' Sub: ExportAllCSV
' Purpose: Export ทั้ง 3 ไฟล์พร้อมกัน (เรียกจาก Form)
'================================================================================
Public Sub ExportAllCSV(AcceptData() As AcceptRecord, AcceptCount As Long, _
                        GraphData() As GraphRecord, GraphCount As Long, _
                        LoopData() As LoopRecord, LoopCount As Long)
    
    ' Export accept-HCA.csv
    Call ExportAcceptHCA(AcceptData, AcceptCount)
    
    ' Export graph-HCA.csv
    Call ExportGraphHCA(GraphData, GraphCount)
    
    ' Export loopPrice-HCA.csv (ถ้ามีการรันหลายครั้ง)
    If LoopCount > 0 Then
        Call ExportLoopPriceHCA(LoopData, LoopCount)
    End If
    
    ' แจ้งเตือนสำเร็จ
    MsgBox "Export completed successfully!" & vbCrLf & _
           "Location: " & ExportFolderPath & vbCrLf & vbCrLf & _
           "Files created:" & vbCrLf & _
           "- accept-HCA.csv (" & AcceptCount & " records)" & vbCrLf & _
           "- graph-HCA.csv (" & GraphCount & " records)" & vbCrLf & _
           IIf(LoopCount > 0, "- loopPrice-HCA.csv (" & LoopCount & " trials)", ""), _
           vbInformation, "Export Complete"
End Sub
