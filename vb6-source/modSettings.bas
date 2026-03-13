Attribute VB_Name = "modSettings"
'================================================================================
' modSettings.bas (Module ใหม่)
' Purpose: Save/Load Settings to/from INI file
'================================================================================

Option Explicit

' Windows API สำหรับ INI file
Private Declare Function WritePrivateProfileString Lib "kernel32" _
    Alias "WritePrivateProfileStringA" ( _
    ByVal lpApplicationName As String, _
    ByVal lpKeyName As Any, _
    ByVal lpString As Any, _
    ByVal lpFileName As String) As Long

Private Declare Function GetPrivateProfileString Lib "kernel32" _
    Alias "GetPrivateProfileStringA" ( _
    ByVal lpApplicationName As String, _
    ByVal lpKeyName As Any, _
    ByVal lpDefault As String, _
    ByVal lpReturnedString As String, _
    ByVal nSize As Long, _
    ByVal lpFileName As String) As Long

' ตำแหน่งไฟล์ INI
Private Const INI_FILE_NAME As String = "RC_RT_HCA_Settings.ini"
Private IniFilePath As String

'================================================================================
' Function: GetIniFilePath
' Purpose: สร้าง path ของไฟล์ INI (อยู่ใน folder เดียวกับ exe)
'================================================================================
Private Function GetIniFilePath() As String
    If IniFilePath = "" Then
        IniFilePath = App.Path
        If Right(IniFilePath, 1) <> "\" Then IniFilePath = IniFilePath & "\"
        IniFilePath = IniFilePath & INI_FILE_NAME
    End If
    GetIniFilePath = IniFilePath
End Function

'================================================================================
' Sub: SaveSettings
' Purpose: บันทึกค่า Input ทั้งหมดลง INI file
'================================================================================
Public Sub SaveSettings(frm As Form)
    On Error GoTo ErrorHandler
    
    Dim iniPath As String
    iniPath = GetIniFilePath()
    
    ' บันทึก Geometry
    Call WritePrivateProfileString("Geometry", "H", frm.Text1.Text, iniPath)
    Call WritePrivateProfileString("Geometry", "H1", frm.Text2.Text, iniPath)
    
    ' บันทึก Soil Properties
    Call WritePrivateProfileString("Soil", "Mu", frm.Text3.Text, iniPath)
    Call WritePrivateProfileString("Soil", "GammaSoil", frm.Text4.Text, iniPath)
    Call WritePrivateProfileString("Soil", "Phi", frm.Text6.Text, iniPath)
    Call WritePrivateProfileString("Soil", "Qa", frm.Text8.Text, iniPath)
    
    ' บันทึก Material Properties
    Call WritePrivateProfileString("Material", "GammaConcrete", frm.Text5.Text, iniPath)
    Call WritePrivateProfileString("Material", "Fc", frm.Text9.Text, iniPath)
    Call WritePrivateProfileString("Material", "Fy", frm.Text10.Text, iniPath)
    Call WritePrivateProfileString("Material", "Cover", frm.Text7.Text, iniPath)
    
    ' บันทึก Algorithm Settings
    Call WritePrivateProfileString("Algorithm", "MaxIterations", frm.Text11.Text, iniPath)
    Call WritePrivateProfileString("Algorithm", "NumTrials", frm.Text14.Text, iniPath)
    
    MsgBox "Settings saved successfully!" & vbCrLf & _
           "Location: " & iniPath, vbInformation, "Save Settings"
    
    Exit Sub

ErrorHandler:
    MsgBox "Error saving settings: " & Err.Description, vbCritical
End Sub

'================================================================================
' Sub: LoadSettings
' Purpose: โหลดค่า Input จาก INI file
'================================================================================
Public Sub LoadSettings(frm As Form)
    On Error GoTo ErrorHandler
    
    Dim iniPath As String
    iniPath = GetIniFilePath()
    
    ' ตรวจสอบว่าไฟล์ INI มีหรือไม่
    If Dir(iniPath) = "" Then
        MsgBox "Settings file not found!" & vbCrLf & _
               "Location: " & iniPath & vbCrLf & vbCrLf & _
               "Using default values.", vbExclamation, "Load Settings"
        Exit Sub
    End If
    
    ' โหลด Geometry
    frm.Text1.Text = ReadIniValue("Geometry", "H", "3.00", iniPath)
    frm.Text2.Text = ReadIniValue("Geometry", "H1", "0.90", iniPath)
    
    ' โหลด Soil Properties
    frm.Text3.Text = ReadIniValue("Soil", "Mu", "0.60", iniPath)
    frm.Text4.Text = ReadIniValue("Soil", "GammaSoil", "1.80", iniPath)
    frm.Text6.Text = ReadIniValue("Soil", "Phi", "25", iniPath)
    frm.Text8.Text = ReadIniValue("Soil", "Qa", "35", iniPath)
    
    ' โหลด Material Properties
    frm.Text5.Text = ReadIniValue("Material", "GammaConcrete", "2.40", iniPath)
    frm.Text9.Text = ReadIniValue("Material", "Fc", "210", iniPath)
    frm.Text10.Text = ReadIniValue("Material", "Fy", "4000", iniPath)
    frm.Text7.Text = ReadIniValue("Material", "Cover", "7.5", iniPath)
    
    ' โหลด Algorithm Settings
    frm.Text11.Text = ReadIniValue("Algorithm", "MaxIterations", "3000", iniPath)
    frm.Text14.Text = ReadIniValue("Algorithm", "NumTrials", "1", iniPath)
    
    MsgBox "Settings loaded successfully!" & vbCrLf & _
           "Location: " & iniPath, vbInformation, "Load Settings"
    
    Exit Sub

ErrorHandler:
    MsgBox "Error loading settings: " & Err.Description, vbCritical
End Sub

'================================================================================
' Function: ReadIniValue
' Purpose: อ่านค่าจาก INI file
'================================================================================
Private Function ReadIniValue(Section As String, Key As String, _
                              DefaultValue As String, iniPath As String) As String
    Dim buffer As String
    Dim ret As Long
    
    buffer = String(255, 0)
    ret = GetPrivateProfileString(Section, Key, DefaultValue, buffer, Len(buffer), iniPath)
    
    If ret > 0 Then
        ReadIniValue = Left(buffer, ret)
    Else
        ReadIniValue = DefaultValue
    End If
End Function

'================================================================================
' Sub: SaveSettingsAs
' Purpose: บันทึกค่า Input ด้วยชื่อไฟล์ที่กำหนด
'================================================================================
Public Sub SaveSettingsAs(frm As Form, Optional FileName As String = "")
    On Error GoTo ErrorHandler
    
    Dim iniPath As String
    
    If FileName = "" Then
        ' ถ้าไม่ระบุชื่อ ให้ใช้ชื่อ default พร้อม DateTime
        FileName = "RC_RT_HCA_Settings_" & Format(Now, "yyyymmdd_hhnnss") & ".ini"
    End If
    
    iniPath = App.Path
    If Right(iniPath, 1) <> "\" Then iniPath = iniPath & "\"
    iniPath = iniPath & FileName
    
    ' บันทึกเหมือน SaveSettings แต่ใช้ path ที่กำหนด
    Call WritePrivateProfileString("Geometry", "H", frm.Text1.Text, iniPath)
    Call WritePrivateProfileString("Geometry", "H1", frm.Text2.Text, iniPath)
    Call WritePrivateProfileString("Soil", "Mu", frm.Text3.Text, iniPath)
    Call WritePrivateProfileString("Soil", "GammaSoil", frm.Text4.Text, iniPath)
    Call WritePrivateProfileString("Soil", "Phi", frm.Text6.Text, iniPath)
    Call WritePrivateProfileString("Soil", "Qa", frm.Text8.Text, iniPath)
    Call WritePrivateProfileString("Material", "GammaConcrete", frm.Text5.Text, iniPath)
    Call WritePrivateProfileString("Material", "Fc", frm.Text9.Text, iniPath)
    Call WritePrivateProfileString("Material", "Fy", frm.Text10.Text, iniPath)
    Call WritePrivateProfileString("Material", "Cover", frm.Text7.Text, iniPath)
    Call WritePrivateProfileString("Algorithm", "MaxIterations", frm.Text11.Text, iniPath)
    Call WritePrivateProfileString("Algorithm", "NumTrials", frm.Text14.Text, iniPath)
    
    MsgBox "Settings saved as: " & vbCrLf & iniPath, vbInformation
    
    Exit Sub

ErrorHandler:
    MsgBox "Error saving settings: " & Err.Description, vbCritical
End Sub

'================================================================================
' Sub: LoadSettingsFrom
' Purpose: โหลดค่า Input จากไฟล์ที่กำหนด
'================================================================================
Public Sub LoadSettingsFrom(frm As Form, FileName As String)
    On Error GoTo ErrorHandler
    
    Dim iniPath As String
    iniPath = FileName
    
    If Dir(iniPath) = "" Then
        MsgBox "File not found: " & iniPath, vbExclamation
        Exit Sub
    End If
    
    ' โหลดเหมือน LoadSettings แต่ใช้ path ที่กำหนด
    frm.Text1.Text = ReadIniValue("Geometry", "H", "3.00", iniPath)
    frm.Text2.Text = ReadIniValue("Geometry", "H1", "0.90", iniPath)
    frm.Text3.Text = ReadIniValue("Soil", "Mu", "0.60", iniPath)
    frm.Text4.Text = ReadIniValue("Soil", "GammaSoil", "1.80", iniPath)
    frm.Text6.Text = ReadIniValue("Soil", "Phi", "25", iniPath)
    frm.Text8.Text = ReadIniValue("Soil", "Qa", "35", iniPath)
    frm.Text5.Text = ReadIniValue("Material", "GammaConcrete", "2.40", iniPath)
    frm.Text9.Text = ReadIniValue("Material", "Fc", "210", iniPath)
    frm.Text10.Text = ReadIniValue("Material", "Fy", "4000", iniPath)
    frm.Text7.Text = ReadIniValue("Material", "Cover", "7.5", iniPath)
    frm.Text11.Text = ReadIniValue("Algorithm", "MaxIterations", "3000", iniPath)
    frm.Text14.Text = ReadIniValue("Algorithm", "NumTrials", "1", iniPath)
    
    MsgBox "Settings loaded from: " & vbCrLf & iniPath, vbInformation
    
    Exit Sub

ErrorHandler:
    MsgBox "Error loading settings: " & Err.Description, vbCritical
End Sub
