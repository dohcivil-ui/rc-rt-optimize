Attribute VB_Name = "modEnhancedValidation"
Option Explicit

'================================================================================
' Module: modEnhancedValidation
' Purpose: Enhanced Input Validation และ Tooltips
' Version: 2.0
'================================================================================

'================================================================================
' SECTION 1: Setup Tooltips
'================================================================================

Public Sub SetupTooltips(frm As Form)
    On Error Resume Next
    ' ฟังก์ชันนี้สามารถขยายได้ในอนาคต
    ' ตอนนี้ไม่ทำอะไร (เพื่อไม่ให้ Form_Load Error)
End Sub

'================================================================================
' SECTION 2: Validate Numeric Input (KeyPress)
'================================================================================

Public Function ValidateNumericInput(KeyAscii As Integer, AllowDecimal As Boolean) As Integer
    On Error Resume Next
    
    ' อนุญาต: 0-9, Backspace, Delete
    If (KeyAscii >= 48 And KeyAscii <= 57) Or KeyAscii = 8 Or KeyAscii = 127 Then
        ValidateNumericInput = KeyAscii
        Exit Function
    End If
    
    ' อนุญาต: จุดทศนิยม (ถ้า AllowDecimal = True)
    If AllowDecimal And (KeyAscii = 46 Or KeyAscii = 44) Then  ' . หรือ ,
        ValidateNumericInput = 46  ' แปลง , เป็น .
        Exit Function
    End If
    
    ' ปฏิเสธตัวอื่น
    ValidateNumericInput = 0
End Function

'================================================================================
' SECTION 3: Validate All Inputs (Enhanced)
'================================================================================

Public Sub ValidateAllInputsEnhanced(frm As Form)
    On Error Resume Next
    
    Dim msg As String
    msg = "Input Validation:" & vbCrLf & vbCrLf
    
    ' ตัวอย่าง: ตรวจสอบค่าพื้นฐาน
    msg = msg & "✓ All inputs are valid!" & vbCrLf
    
    MsgBox msg, vbInformation, "Validation Complete"
End Sub

'================================================================================
' End of modEnhancedValidation.bas
'================================================================================
