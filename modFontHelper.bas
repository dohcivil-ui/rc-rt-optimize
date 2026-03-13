Attribute VB_Name = "modFontHelper"
'================================================================================
' modFontHelper.bas (Module ใหม่)
' Purpose: ตั้งค่าฟอนต์ภาษาไทย "Cordia New" อัตโนมัติ
'================================================================================

Option Explicit

' Constants
Private Const THAI_FONT_NAME As String = "Cordia New"
Private Const THAI_FONT_FALLBACK As String = "CordiaUPC"
Private Const THAI_FONT_SIZE As Integer = 16
Private Const THAI_CHARSET As Integer = 222  ' Thai Charset

'================================================================================
' Sub: SetupThaiFont
' Purpose: ตั้งค่าฟอนต์ภาษาไทยสำหรับทุก Control ใน Form
'================================================================================
Public Sub SetupThaiFont(frm As Form)
    On Error Resume Next
    
    Dim ctrl As Control
    Dim fontName As String
    
    ' ตรวจสอบว่ามีฟอนต์หรือไม่
    fontName = GetAvailableThaiFont(frm)
    
    ' Loop ทุก Control
    For Each ctrl In frm.Controls
        ' ตั้งค่าฟอนต์ตาม Control Type
        Select Case TypeName(ctrl)
            Case "Label"
                SetControlFont ctrl, fontName, THAI_FONT_SIZE, False
                
            Case "CommandButton"
                SetControlFont ctrl, fontName, 14, False
                
            Case "TextBox"
                SetControlFont ctrl, fontName, 14, False
                
            Case "Frame"
                SetControlFont ctrl, fontName, THAI_FONT_SIZE, True
                
            Case "OptionButton", "CheckBox"
                SetControlFont ctrl, fontName, 14, False
                
        End Select
    Next ctrl
End Sub

'================================================================================
' Sub: SetControlFont
' Purpose: ตั้งค่าฟอนต์สำหรับ Control เดียว
'================================================================================
Private Sub SetControlFont(ctrl As Control, fontName As String, _
                          fontSize As Integer, isBold As Boolean)
    On Error Resume Next
    
    With ctrl.Font
        .Name = fontName
        .Size = fontSize
        .Charset = THAI_CHARSET
        .Bold = isBold
    End With
End Sub

'================================================================================
' Function: GetAvailableThaiFont
' Purpose: ตรวจสอบและคืนค่าฟอนต์ภาษาไทยที่มีในระบบ
'================================================================================
Private Function GetAvailableThaiFont(frm As Form) As String
    On Error Resume Next
    
    ' ลองตั้งฟอนต์หลัก
    If IsFontAvailable(frm, THAI_FONT_NAME) Then
        GetAvailableThaiFont = THAI_FONT_NAME
        Exit Function
    End If
    
    ' ลองตั้งฟอนต์สำรอง
    If IsFontAvailable(frm, THAI_FONT_FALLBACK) Then
        GetAvailableThaiFont = THAI_FONT_FALLBACK
        Exit Function
    End If
    
    ' ลองฟอนต์อื่นๆ
    If IsFontAvailable(frm, "Angsana New") Then
        GetAvailableThaiFont = "Angsana New"
        Exit Function
    End If
    
    If IsFontAvailable(frm, "Browallia New") Then
        GetAvailableThaiFont = "Browallia New"
        Exit Function
    End If
    
    ' ถ้าไม่มีเลย ใช้ Arial
    GetAvailableThaiFont = "Arial"
    
    ' แจ้งเตือน
    MsgBox "ไม่พบฟอนต์ภาษาไทยที่แนะนำ (Cordia New)" & vbCrLf & vbCrLf & _
           "กำลังใช้ฟอนต์: " & GetAvailableThaiFont & vbCrLf & vbCrLf & _
           "แนะนำให้ติดตั้งฟอนต์ 'Cordia New' หรือ 'CordiaUPC'", _
           vbExclamation, "Font Warning"
End Function

'================================================================================
' Function: IsFontAvailable
' Purpose: ตรวจสอบว่ามีฟอนต์ในระบบหรือไม่
'================================================================================
Private Function IsFontAvailable(frm As Form, fontName As String) As Boolean
    On Error Resume Next
    
    Dim testLabel As Label
    Set testLabel = frm.Controls.Add("VB.Label", "tmpFontTest" & Timer)
    
    testLabel.Font.Name = fontName
    IsFontAvailable = (testLabel.Font.Name = fontName)
    
    frm.Controls.Remove testLabel.Name
    Set testLabel = Nothing
End Function

'================================================================================
' Sub: SetThaiLabelFont
' Purpose: ตั้งค่าฟอนต์สำหรับ Labels ที่ระบุ
'================================================================================
Public Sub SetThaiLabelFont(ParamArray Labels() As Variant)
    On Error Resume Next
    
    Dim i As Integer
    Dim ctrl As Object
    
    For i = LBound(Labels) To UBound(Labels)
        Set ctrl = Labels(i)
        With ctrl.Font
            .Name = THAI_FONT_NAME
            .Size = THAI_FONT_SIZE
            .Charset = THAI_CHARSET
        End With
    Next i
End Sub

'================================================================================
' Sub: SetThaiButtonFont
' Purpose: ตั้งค่าฟอนต์สำหรับ Buttons ที่ระบุ
'================================================================================
Public Sub SetThaiButtonFont(ParamArray Buttons() As Variant)
    On Error Resume Next
    
    Dim i As Integer
    Dim ctrl As Object
    
    For i = LBound(Buttons) To UBound(Buttons)
        Set ctrl = Buttons(i)
        With ctrl.Font
            .Name = THAI_FONT_NAME
            .Size = 14
            .Charset = THAI_CHARSET
        End With
    Next i
End Sub

'================================================================================
' Sub: SetThaiHeaderFont
' Purpose: ตั้งค่าฟอนต์สำหรับหัวข้อใหญ่ (Bold + Size ใหญ่)
'================================================================================
Public Sub SetThaiHeaderFont(ParamArray Labels() As Variant)
    On Error Resume Next
    
    Dim i As Integer
    Dim ctrl As Object
    
    For i = LBound(Labels) To UBound(Labels)
        Set ctrl = Labels(i)
        With ctrl.Font
            .Name = THAI_FONT_NAME
            .Size = 20
            .Charset = THAI_CHARSET
            .Bold = True
        End With
    Next i
End Sub

'================================================================================
' Sub: SetupThaiMsgBox (Utility)
' Purpose: แสดง MsgBox ด้วยฟอนต์ภาษาไทย
' หมายเหตุ: VB6 ไม่สามารถเปลี่ยนฟอนต์ MsgBox ได้โดยตรง
'          ต้องสร้าง Custom Form แทน
'================================================================================
Public Function ShowThaiMsgBox(Message As String, Title As String, _
                              Optional Icon As VbMsgBoxStyle = vbInformation) As VbMsgBoxResult
    ' ใช้ MsgBox ปกติ (ไม่สามารถเปลี่ยนฟอนต์ได้)
    ShowThaiMsgBox = MsgBox(Message, Icon, Title)
    
    ' หรือสร้าง Custom Form ถ้าต้องการควบคุมฟอนต์
    ' (ต้องสร้าง frmCustomMsgBox แยก)
End Function

'================================================================================
' ตัวอย่างการใช้งาน
'================================================================================
'
' ใน Form_Load ของ Form1:
' ------------------------
' Private Sub Form_Load()
'     ' วิธีที่ 1: ตั้งค่าทุก Control อัตโนมัติ
'     Call modFontHelper.SetupThaiFont(Me)
'
'     ' วิธีที่ 2: ตั้งค่าเฉพาะ Labels ที่ระบุ
'     Call modFontHelper.SetThaiLabelFont(Label1, Label2, Label3, lblTotalCost)
'
'     ' วิธีที่ 3: ตั้งค่าเฉพาะ Buttons ที่ระบุ
'     Call modFontHelper.SetThaiButtonFont(cmdSaveSettings, cmdLoadSettings, cmdGeneratePDF)
'
'     ' วิธีที่ 4: ตั้งค่าหัวข้อ (Bold + ขนาดใหญ่)
'     Call modFontHelper.SetThaiHeaderFont(lblTitle, lblResultsHeader)
' End Sub
