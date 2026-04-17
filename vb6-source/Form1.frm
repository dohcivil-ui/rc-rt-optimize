VERSION 5.00
Begin VB.Form Form1 
   Caption         =   "RC_RT_HCA v2.0 - Reinforced Concrete Retaining Wall Design"
   ClientHeight    =   9705
   ClientLeft      =   930
   ClientTop       =   2730
   ClientWidth     =   22320
   BeginProperty Font 
      Name            =   "CordiaUPC"
      Size            =   15.75
      Charset         =   222
      Weight          =   400
      Underline       =   0   'False
      Italic          =   0   'False
      Strikethrough   =   0   'False
   EndProperty
   LinkTopic       =   "Form1"
   ScaleHeight     =   9705
   ScaleWidth      =   22320
   ShowInTaskbar   =   0   'False
   Begin VB.CommandButton cmdCompare 
      Caption         =   "Compare"
      BeginProperty Font 
         Name            =   "CordiaUPC"
         Size            =   18
         Charset         =   222
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      Height          =   615
      Left            =   15840
      TabIndex        =   43
      Top             =   8760
      Width           =   1440
   End
   Begin VB.CommandButton cmdBA 
      Caption         =   "BA"
      BeginProperty Font 
         Name            =   "CordiaUPC"
         Size            =   18
         Charset         =   222
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      Height          =   615
      Left            =   14160
      TabIndex        =   42
      Top             =   8760
      Width           =   1440
   End
   Begin VB.ComboBox cboSteelGrade 
      Height          =   555
      ItemData        =   "Form1.frx":0000
      Left            =   3720
      List            =   "Form1.frx":0002
      Style           =   2  'Dropdown List
      TabIndex        =   38
      Top             =   7440
      Width           =   1455
   End
   Begin VB.Frame fraResults 
      Caption         =   "ผลลัพธ์การออกแบบ (Design Results)"
      BeginProperty Font 
         Name            =   "CordiaUPC"
         Size            =   15.75
         Charset         =   222
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      ForeColor       =   &H00FF0000&
      Height          =   6855
      Left            =   6120
      TabIndex        =   36
      Top             =   2520
      Width           =   6135
      Begin VB.ListBox lstResults 
         BeginProperty Font 
            Name            =   "CordiaUPC"
            Size            =   14.25
            Charset         =   222
            Weight          =   400
            Underline       =   0   'False
            Italic          =   0   'False
            Strikethrough   =   0   'False
         EndProperty
         Height          =   5910
         Left            =   120
         TabIndex        =   37
         Top             =   480
         Width           =   5895
      End
   End
   Begin VB.Frame fraGraph 
      Caption         =   "กราฟค่าใช้จ่าย (Cost Reduction Graph)"
      BeginProperty Font 
         Name            =   "CordiaUPC"
         Size            =   15.75
         Charset         =   222
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      ForeColor       =   &H00FF0000&
      Height          =   7095
      Left            =   12360
      TabIndex        =   34
      Top             =   240
      Width           =   9615
      Begin VB.PictureBox picGraph 
         AutoRedraw      =   -1  'True
         BackColor       =   &H00FFFFFF&
         Height          =   6375
         Left            =   120
         ScaleHeight     =   6315
         ScaleWidth      =   9195
         TabIndex        =   35
         TabStop         =   0   'False
         Top             =   360
         Width           =   9255
      End
   End
   Begin VB.CommandButton cmdRun 
      Caption         =   "HCA "
      BeginProperty Font 
         Name            =   "CordiaUPC"
         Size            =   18
         Charset         =   222
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      Height          =   615
      Left            =   12480
      TabIndex        =   33
      Top             =   8760
      Width           =   1440
   End
   Begin VB.Frame fraAlgorithm 
      Caption         =   "การตั้งค่าอัลกอริทึม (Algorithm Settings)"
      BeginProperty Font 
         Name            =   "CordiaUPC"
         Size            =   15.75
         Charset         =   222
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      ForeColor       =   &H00FF0000&
      Height          =   2400
      Left            =   6240
      TabIndex        =   27
      Top             =   120
      Width           =   5880
      Begin VB.TextBox txtTrials 
         Height          =   615
         Left            =   3800
         TabIndex        =   32
         Text            =   "30"
         Top             =   1200
         Width           =   1200
      End
      Begin VB.TextBox txtMaxIter 
         Height          =   615
         Left            =   3800
         TabIndex        =   29
         Text            =   "5000"
         Top             =   360
         Width           =   1200
      End
      Begin VB.Label lblTrials 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "จำนวนครั้งที่ทดสอบ (Number of Trials) :"
         Height          =   435
         Left            =   120
         TabIndex        =   31
         Top             =   1200
         Width           =   3615
      End
      Begin VB.Label lblMaxIter_Unit 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "รอบ"
         Height          =   435
         Left            =   5100
         TabIndex        =   30
         Top             =   400
         Width           =   345
      End
      Begin VB.Label lblMaxIter 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "จำนวนรอบการคำนวณ (Max Iterations) : "
         Height          =   435
         Left            =   120
         TabIndex        =   28
         Top             =   360
         Width           =   3645
      End
   End
   Begin VB.Frame fraMaterial 
      Caption         =   "คุณสมบัติวัสดุ (Material Properties)"
      BeginProperty Font 
         Name            =   "CordiaUPC"
         Size            =   15.75
         Charset         =   222
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      ForeColor       =   &H00FF0000&
      Height          =   3855
      Left            =   240
      TabIndex        =   19
      Top             =   5520
      Width           =   5775
      Begin VB.ComboBox cboConcreteStrength 
         Height          =   555
         Left            =   3480
         Style           =   2  'Dropdown List
         TabIndex        =   39
         Top             =   2760
         Width           =   1455
      End
      Begin VB.TextBox txtCover 
         Height          =   615
         Left            =   3480
         TabIndex        =   25
         Text            =   "7.50"
         Top             =   1080
         Width           =   1200
      End
      Begin VB.TextBox txtGammaCon 
         Height          =   615
         Left            =   3500
         TabIndex        =   21
         Text            =   "2.40"
         Top             =   360
         Width           =   1200
      End
      Begin VB.Label lblConcreteStrength 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "กำลังอัดคอนกรีต (f'c):"
         Height          =   435
         Left            =   240
         TabIndex        =   41
         Top             =   2880
         Width           =   1950
      End
      Begin VB.Label lblSteelGrade 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "เกรดเหล็กเสริม (Steel Grade):"
         Height          =   435
         Left            =   120
         TabIndex        =   40
         Top             =   2040
         Width           =   2670
      End
      Begin VB.Label lblCover_Unit 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "ซม."
         Height          =   435
         Left            =   4920
         TabIndex        =   26
         Top             =   1200
         Width           =   315
      End
      Begin VB.Label lblCover 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "ความหนาคอนกรีตหุ้มเหล็ก (Cover) :"
         Height          =   435
         Left            =   120
         TabIndex        =   24
         Top             =   1200
         Width           =   3210
      End
      Begin VB.Label lblFc_Unit 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "ksc."
         Height          =   435
         Left            =   5040
         TabIndex        =   23
         Top             =   2880
         Width           =   390
      End
      Begin VB.Label lblGammaCon_Unit 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "ตัน/ลบ.ม."
         Height          =   435
         Left            =   4800
         TabIndex        =   22
         Top             =   480
         Width           =   855
      End
      Begin VB.Label lblGammaCon 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "น้ำหนักหน่วยคอนกรีต (gamma-con) :"
         Height          =   435
         Left            =   120
         TabIndex        =   20
         Top             =   405
         Width           =   3315
      End
   End
   Begin VB.Frame fraSoil 
      Caption         =   "คุณสมบัติของดิน  (Soil Properties)"
      BeginProperty Font 
         Name            =   "CordiaUPC"
         Size            =   15.75
         Charset         =   222
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      ForeColor       =   &H00FF0000&
      Height          =   3480
      Left            =   240
      TabIndex        =   7
      Top             =   1920
      Width           =   5800
      Begin VB.TextBox txtQa 
         Height          =   615
         Left            =   3000
         TabIndex        =   17
         Text            =   "30"
         Top             =   2520
         Width           =   1200
      End
      Begin VB.TextBox txtPhi 
         Height          =   615
         Left            =   3000
         TabIndex        =   14
         Text            =   "30"
         Top             =   1800
         Width           =   1200
      End
      Begin VB.TextBox txtGammaSoil 
         Height          =   615
         Left            =   3000
         TabIndex        =   11
         Text            =   "1.80"
         Top             =   1080
         Width           =   1200
      End
      Begin VB.TextBox txtMu 
         Height          =   615
         Left            =   3000
         TabIndex        =   9
         Text            =   "0.60"
         Top             =   360
         Width           =   1200
      End
      Begin VB.Label lblQa_Unit 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "ตัน/ตร.ม."
         Height          =   435
         Left            =   4320
         TabIndex        =   18
         Top             =   2565
         Width           =   810
      End
      Begin VB.Label lblQa 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "กำลังรับน้ำหนักของดินเดิม (qa) :"
         Height          =   435
         Left            =   120
         TabIndex        =   16
         Top             =   2565
         Width           =   2835
      End
      Begin VB.Label lblPhi_Unit 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "องศา"
         Height          =   435
         Left            =   4320
         TabIndex        =   15
         Top             =   1840
         Width           =   465
      End
      Begin VB.Label lblPhi 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "มุมเสียดทานภายใน (phi) : "
         Height          =   435
         Left            =   240
         TabIndex        =   13
         Top             =   1840
         Width           =   2355
      End
      Begin VB.Label lblGammaSoil_Unit 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "ตัน/ลบ.ม."
         Height          =   435
         Left            =   4320
         TabIndex        =   12
         Top             =   1120
         Width           =   1120
      End
      Begin VB.Label lblGammaSoil 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "น้ำหนักหน่วยดิน (gamma-soil) :"
         Height          =   435
         Left            =   120
         TabIndex        =   10
         Top             =   1125
         Width           =   2805
      End
      Begin VB.Label lblMu 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "ส.ป.ส.แรงเสียดทาน (mu) :"
         Height          =   435
         Left            =   240
         TabIndex        =   8
         Top             =   400
         Width           =   2340
      End
   End
   Begin VB.Frame fraGeometry 
      Caption         =   "ขนาดเรขาคณิต (Geometry)"
      BeginProperty Font 
         Name            =   "CordiaUPC"
         Size            =   15.75
         Charset         =   222
         Weight          =   700
         Underline       =   0   'False
         Italic          =   0   'False
         Strikethrough   =   0   'False
      EndProperty
      ForeColor       =   &H00FF0000&
      Height          =   1680
      Left            =   240
      TabIndex        =   0
      Top             =   120
      Width           =   5800
      Begin VB.TextBox txtH1 
         Height          =   555
         Left            =   3000
         TabIndex        =   5
         Text            =   "1.20"
         Top             =   960
         Width           =   1200
      End
      Begin VB.TextBox txtH 
         Height          =   555
         Left            =   3000
         TabIndex        =   2
         Text            =   "3.00"
         Top             =   360
         Width           =   1200
      End
      Begin VB.Label lblH1_Unit 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "m."
         Height          =   435
         Left            =   4320
         TabIndex        =   6
         Top             =   960
         Width           =   225
      End
      Begin VB.Label lblH1 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "ความสูงดินถม (H1) :"
         Height          =   435
         Left            =   240
         TabIndex        =   4
         Top             =   960
         Width           =   1845
      End
      Begin VB.Label lblH_Unit 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "m."
         Height          =   435
         Left            =   4320
         TabIndex        =   3
         Top             =   400
         Width           =   225
      End
      Begin VB.Label lblH 
         AutoSize        =   -1  'True
         BackStyle       =   0  'Transparent
         Caption         =   "ความสูงกำแพง (H) :"
         Height          =   435
         Left            =   240
         TabIndex        =   1
         Top             =   400
         Width           =   1800
      End
   End
End
Attribute VB_Name = "Form1"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit
' === Module-Level Variables for Compare Graph ===
Private HCA_CostHistory() As Double
Private BA_CostHistory() As Double
Private HCA_MaxIter As Long
Private BA_MaxIter As Long
Private HCA_BestIteration As Long
Private BA_BestIteration As Long
Private HCA_HasData As Boolean
Private BA_HasData As Boolean

' --- Stored results for Compare ---
Dim hcaStoredHistory() As Double
Dim hcaStoredBestCost As Double
Dim hcaStoredBestIter As Long
Dim hcaStoredMaxIter As Long
Dim hcaHasRun As Boolean

Dim baStoredHistory() As Double
Dim baStoredBestCost As Double
Dim baStoredBestIter As Long
Dim baStoredMaxIter As Long
Dim baHasRun As Boolean

' ==========================================
' Form Variables
' ==========================================
Private bestDesign As Design
Private selectedMaterial As MaterialProperties
' Material Arrays
Private fyArray(1 To 2) As Integer
Private fcArray(1 To 8) As Integer  ' รองรับ 8 ค่า: 180,210,240,280,300,320,350,400

' ================================================================================
' ปุ่มคำนวณด้วยวิธี Bisection Algorithm (BA) - VERSION 9.0
' Bisection Base + HCA Random (tt, tb, TBase, LToe, Steel)
' ================================================================================
Private Sub cmdBA_Click()
    Dim H As Double, H1 As Double, mu As Double
    Dim gamma_soil As Double, phi As Double, qa As Double
    Dim gamma_con As Double, cover As Double
    Dim maxIter As Long, numTrials As Integer
    
    Dim fc As Integer, concretePrice As Double
    Dim selectedMaterial As MaterialProperties
    Dim trialDesign As Design, bestDesign As Design
    Dim trialCost As Double, globalBestCost As Double
    Dim globalBestTrial As Integer, globalBestIteration As Long
    Dim globalBestCostHistory() As Double
    
    lstResults.Clear
    
    If Not ValidateInputs() Then
        MsgBox "กรุณาตรวจสอบข้อมูล!", vbExclamation, "ข้อผิดพลาด"
        Exit Sub
    End If
    
    H = CDbl(txtH.Text)
    H1 = CDbl(txtH1.Text)
    mu = CDbl(txtMu.Text)
    gamma_soil = CDbl(txtGammaSoil.Text)
    phi = CDbl(txtPhi.Text)
    qa = CDbl(txtQa.Text)
    gamma_con = CDbl(txtGammaCon.Text)
    cover = CDbl(txtCover.Text) / 100
    maxIter = CLng(txtMaxIter.Text)
    numTrials = 30
    
    If cboConcreteStrength.Text = "Random" Then
        Dim fcOptionsBA(1 To 5) As Integer
        fcOptionsBA(1) = 180
        fcOptionsBA(2) = 210
        fcOptionsBA(3) = 240
        fcOptionsBA(4) = 280
        fcOptionsBA(5) = 320
        Randomize Timer
        fc = fcOptionsBA(Int(Rnd * 5) + 1)
    Else
        fc = CInt(cboConcreteStrength.Text)
    End If
    
    concretePrice = modShared.GetConcretePrice(fc)
    selectedMaterial = modShared.GetSD40Material(fc, concretePrice, modShared.STEEL_PRICE_SD40)
    
    cmdBA.Enabled = False
    Me.MousePointer = vbHourglass
    
    lstResults.AddItem "============================================"
    lstResults.AddItem "BA v9.0 (Bisection Base + HCA Random)"
    lstResults.AddItem "============================================"
    lstResults.AddItem "กำลังคำนวณ " & numTrials & " Trials..."
    DoEvents
    
    Call modBA.InitLoopCounter_BA
    globalBestCost = 999999999
    globalBestTrial = 0
    globalBestIteration = 0
    
    Randomize Timer
    
    Dim trial As Integer
    For trial = 1 To numTrials
        modDataStructures.BestCostIteration = 0
        
        trialDesign = modBA.BisectionOptimization( _
            maxIter, H, H1, gamma_soil, gamma_con, phi, mu, qa, cover, selectedMaterial)
        
        trialCost = modShared.CalculateCost(trialDesign)
        Call modBA.LogLoopResult_BA(trialCost)
        
        Debug.Print "Trial " & trial & ": Cost=" & Format(trialCost, "#,##0.00")
        
        If trialCost < globalBestCost Then
            globalBestCost = trialCost
            bestDesign = trialDesign
            globalBestTrial = trial
            globalBestIteration = modDataStructures.BestCostIteration
            
            ReDim globalBestCostHistory(1 To maxIter)
            Dim k As Long
            For k = 1 To maxIter
                globalBestCostHistory(k) = modBA.CostHistory_BA(k)
            Next k
        End If
        
        lstResults.Clear
        lstResults.AddItem "============================================"
        lstResults.AddItem "BA v9.0 - Trial " & trial & "/" & numTrials
        lstResults.AddItem "============================================"
        lstResults.AddItem "Trial Cost: " & Format(trialCost, "#,##0.00") & " Baht/m"
        lstResults.AddItem "Best So Far: " & Format(globalBestCost, "#,##0.00") & " (Trial " & globalBestTrial & ")"
        DoEvents
    Next trial
    
    modDataStructures.BestTrial = globalBestTrial
    modDataStructures.BestCostIteration = globalBestIteration
    
    Dim resultText As String
    resultText = modShared.FormatResults(bestDesign, selectedMaterial, "Bisection Algorithm v1.0")
    
    Dim lines() As String
    lines = Split(resultText, vbCrLf)
    
    lstResults.Clear
    Dim j As Integer
    For j = 0 To UBound(lines)
        lstResults.AddItem lines(j)
    Next j
    
    Call DrawCostGraph(picGraph, globalBestCostHistory, globalBestIteration)
    
    cmdBA.Enabled = True
    Me.MousePointer = vbDefault
    
    Call modBA.SaveAcceptCSV_BA(H)
    Call modBA.SaveLoopPriceCSV_BA(H)
    
    MsgBox "การคำนวณเสร็จสมบูรณ์!" & vbCrLf & vbCrLf & _
           "จำนวน Trials: " & numTrials & vbCrLf & _
           "Iterations/Trial: " & maxIter & vbCrLf & vbCrLf & _
           "ไฟล์ CSV ที่บันทึก:" & vbCrLf & _
           "- D:\accept-BA-H" & Format(H, "0") & ".csv" & vbCrLf & _
           "- D:\loopPrice-BA-H" & Format(H, "0") & ".csv", _
           vbInformation, "สำเร็จ"
           ' === เก็บข้อมูลสำหรับ Compare Graph ===
    BA_CostHistory = globalBestCostHistory
    BA_MaxIter = maxIter
    BA_BestIteration = globalBestIteration
    BA_HasData = True
    
    ' --- Store results for Compare ---
baStoredBestCost = globalBestCost
baStoredBestIter = globalBestIteration
baStoredMaxIter = maxIter
ReDim baStoredHistory(1 To maxIter)
Dim siBA As Long
For siBA = 1 To maxIter
    baStoredHistory(siBA) = globalBestCostHistory(siBA)
Next siBA
baHasRun = True
    
    
    
End Sub
' ========================================
' Form Load Event
' ========================================
Private Sub Form_Load()
    ' Initialize arrays
    Call InitializeArrays
    
    ' v2.4: ซ่อน ComboBox เกรดเหล็ก
    cboSteelGrade.Clear
    cboSteelGrade.AddItem "SD40"
    cboSteelGrade.ListIndex = 0
    cboSteelGrade.Visible = False
    
    ' v2.4: ตัด f'c 350, 400 ออก
    cboConcreteStrength.Clear
    cboConcreteStrength.AddItem "180"
    cboConcreteStrength.AddItem "210"
    cboConcreteStrength.AddItem "240"
    cboConcreteStrength.AddItem "280"
    cboConcreteStrength.AddItem "320"
     cboConcreteStrength.AddItem "350"
    cboConcreteStrength.AddItem "Random"
    cboConcreteStrength.ListIndex = 6
    
    ' Set default values
    'txtH.Text = "3.00"
    'txtH1.Text = "1.00"
    'txtMu.Text = "0.60"
    'txtGammaSoil.Text = "1.80"
    'txtPhi.Text = "25"
    'txtQa.Text = "30"
    'txtGammaCon.Text = "2.40"
    'txtCover.Text = "7.50"
    'txtMaxIter.Text = "6000"
    'txtTrials.Text = "1"
    
    ' Clear results
    lstResults.Clear
    Call ClearGraph(picGraph)
    
    ' Enable Run button
    cmdRun.Enabled = True
    Me.MousePointer = vbDefault
    
    ' Reset stored compare flags
hcaHasRun = False
baHasRun = False
    
End Sub
' ========================================
' Run Button Click HCA Event
' ========================================
Private Sub cmdRun_Click()
    Dim H As Double
    Dim H1 As Double
    Dim mu As Double
    Dim gamma_soil As Double
    Dim phi As Double
    Dim qa As Double
    Dim gamma_con As Double
    Dim cover As Double
    Dim maxIter As Long
    Dim numTrials As Integer
    Dim trial As Integer
    ' === ตัวแปรเก็บ Best จากทุก Trials ===
    Dim globalBestDesign As Design
    Dim globalBestCost As Double
    Dim globalBestTrial As Integer
    Dim globalBestIteration As Long
    Dim currentCost As Double
    Dim globalBestCostHistory() As Double   ' เพิ่มบรรทัดนี้
    
    Call InitializeArrays
    
    ' Clear results
    lstResults.Clear
    
    ' === Input Validation ===
    If Not ValidateInputs() Then
        MsgBox "กรุณาตรวจสอบข้อมูลที่ป้อน!", vbExclamation, "ข้อผิดพลาด"
        Exit Sub
    End If
    
    ' === Read Inputs ===
    H = CDbl(txtH.Text)
    H1 = CDbl(txtH1.Text)
    mu = CDbl(txtMu.Text)
    gamma_soil = CDbl(txtGammaSoil.Text)
    phi = CDbl(txtPhi.Text)
    qa = CDbl(txtQa.Text)
    gamma_con = CDbl(txtGammaCon.Text)
    cover = CDbl(txtCover.Text) / 100  ' Convert cm to m
    maxIter = CLng(txtMaxIter.Text)
    numTrials = CInt(txtTrials.Text)
    
    ' ============================================
    ' v2.4: ล็อค SD40 และ Validate f'c
    ' ============================================
    Dim fc As Integer
    
    If cboConcreteStrength.Text = "Random" Then
        Dim fcOptions(1 To 5) As Integer
        fcOptions(1) = 180
        fcOptions(2) = 210
        fcOptions(3) = 240
        fcOptions(4) = 280
        fcOptions(5) = 320
        Randomize Timer
        fc = fcOptions(Int(Rnd * 5) + 1)
    Else
        fc = CInt(cboConcreteStrength.Text)
    End If
    
    Dim concretePrice As Double
    
    concretePrice = GetConcretePrice(fc)
    
    selectedMaterial = GetSD40Material(fc, concretePrice, STEEL_PRICE_SD40)
    
    Debug.Print "[PRICE] f'c=" & fc & " -> Concrete=" & concretePrice & " Baht/m3, Steel=" & STEEL_PRICE_SD40 & " Baht/kg"
    'ราคาคอนกรีตผสมเสร็จและราคาเหล็กเสริมของพาณิชย์จังหวัดมหาสารคาม ประจำเดือนกันยายน พ.ศ. 2562 (ไม่รวมภาษีมูลค่าเพิ่มและค่าขนส่ง)
    'เนื่องจากเป็นราคาวัสดุภายในพื้นที่ของการทำงานวิจัยนี้ ส่วนค่าแรงงานกำหนดใช้จากบัญชีค่าแรง / ค่าดำเนินการสำหรับถอดแบบ คำนวณราคากลางงานก่อสร้างฉบับปรับปรุงปี พ.ศ. 2560
    '180 cyl = 1,962+391 =2353 บาท/ลบม (391 คือค่าแรง)
    '210 cyl = 2,000+391 =2391 บาท/ลบม
    '240 cyl = 2,042+391 =2433 บาท/ลบม
    '280 cyl = 2,121+391 =2512 บาท/ลบม
    '300 cyl = 2,163+391 =2554 บาท/ลบม
    '320 cyl = 2,210+391 =2601 บาท/ลบม
    '350 cyl = 2,392+391 =2783 บาท/ลบม

    'sd30 = 20+3 =23 บาท/กก (3 บาท/กก คือค่าแรง)
    'sd40 = 21+3 =24 บาท/กก
    
    ' Initialize random seed
    Randomize Timer
    
    ' Disable button during calculation
    cmdRun.Enabled = False
    Me.MousePointer = vbHourglass
    
    ' ============================================
    ' v2.4.2: Run Multiple Trials with CSV Export
    ' ============================================
    
  ' เริ่มต้นค่า Global Best
    globalBestCost = 999999999
    globalBestTrial = 0
    globalBestIteration = 0
    
    ' เริ่มต้น Loop Counter (สำหรับ loopPrice-HCA)
    Call InitLoopCounter
    
    ' วน Loop ตามจำนวน Trials
    For trial = 1 To numTrials
        Debug.Print "========================================"
        Debug.Print "=== TRIAL " & trial & " / " & numTrials & " ==="
        Debug.Print "========================================"
        
        ' แสดงสถานะใน ListBox
        lstResults.Clear
        lstResults.AddItem "กำลังคำนวณ Trial " & trial & " / " & numTrials & "..."
        If globalBestTrial > 0 Then
            lstResults.AddItem "Global Best: " & Format(globalBestCost, "#,##0.00") & " Baht/m (Trial " & globalBestTrial & ")"
        End If
        DoEvents
        
        ' Run Optimization
        bestDesign = HillClimbingOptimization( _
            maxIter, H, H1, gamma_soil, gamma_con, phi, mu, qa, cover, selectedMaterial)
        
        ' คำนวณราคาของ Trial นี้
        currentCost = CalculateCost(bestDesign)
        
       ' เปรียบเทียบกับ Global Best
        If currentCost < globalBestCost Then
            globalBestDesign = bestDesign
            globalBestCost = currentCost
            globalBestTrial = trial
            globalBestIteration = modDataStructures.BestCostIteration
            ' เก็บ CostHistory ของ Trial ที่ดีที่สุด
            globalBestCostHistory = modDataStructures.CostHistory
            Debug.Print ">>> NEW GLOBAL BEST at Trial " & trial & ": " & Format(globalBestCost, "#,##0.00") & " Baht/m"
        End If
        ' === เพิ่มบรรทัดนี้! บันทึกผล Trial ===
        Call LogLoopResult(currentCost)
        ' อัพเดท UI
        DoEvents
    Next trial
    
    ' บันทึก loopPrice-HCA (หลังจบทุก Trial)
    Call SaveLoopPriceCSV(H)
    
 ' === ใช้ Global Best สำหรับแสดงผล ===
    bestDesign = globalBestDesign
    modDataStructures.BestCostIteration = globalBestIteration
    modDataStructures.BestTrial = globalBestTrial
    
    ' ============================================
    ' === Display Results (Trial สุดท้าย) ===
    ' ============================================
    Dim resultText As String
    resultText = FormatResults(bestDesign, selectedMaterial)
    
    ' แสดงผลใน ListBox (แบ่งบรรทัด)
    Dim lines() As String
    Dim i As Integer
    lines = Split(resultText, vbCrLf)
    
    lstResults.Clear
    For i = 0 To UBound(lines)
        lstResults.AddItem lines(i)
    Next i
    
    ' === Draw Graph ===
    'Call DrawCostGraph(picGraph, modDataStructures.CostHistory, modDataStructures.BestCostIteration)
     ' === Draw Graph (ใช้ CostHistory ของ Trial ที่ดีที่สุด) ===
    Call DrawCostGraph(picGraph, globalBestCostHistory, globalBestIteration)
    
    ' Re-enable button
    cmdRun.Enabled = True
    Me.MousePointer = vbDefault
    
    ' บันทึก CSV เฉพาะครั้งสุดท้าย (Trial สุดท้าย)
    Call SaveAcceptCSV(H)
    Call SaveLoopPriceCSV(H)
    
    ' แสดงข้อความสรุปครั้งเดียวตอนจบ
    MsgBox "การคำนวณเสร็จสมบูรณ์!" & vbCrLf & vbCrLf & _
           "จำนวน Trials: " & numTrials & vbCrLf & _
           "Iterations/Trial: " & maxIter & vbCrLf & vbCrLf & _
           "ไฟล์ CSV ที่บันทึก:" & vbCrLf & _
           "- D:\accept-HCA-H" & Format(H, "0") & ".csv" & vbCrLf & _
           "- D:\loopPrice-HCA-H" & Format(H, "0") & ".csv", _
           vbInformation, "สำเร็จ"
           ' === เก็บข้อมูลสำหรับ Compare Graph ===
    HCA_CostHistory = globalBestCostHistory
    HCA_MaxIter = maxIter
    HCA_BestIteration = globalBestIteration
    HCA_HasData = True
    
    ' --- Store results for Compare ---
hcaStoredBestCost = globalBestCost
hcaStoredBestIter = globalBestIteration
hcaStoredMaxIter = maxIter
ReDim hcaStoredHistory(1 To maxIter)
Dim siHCA As Long
For siHCA = 1 To maxIter
    hcaStoredHistory(siHCA) = globalBestCostHistory(siHCA)
Next siHCA
hcaHasRun = True
    
    
End Sub

' ========================================
' Input Validation
' ========================================
Private Function ValidateInputs() As Boolean
    ValidateInputs = False
    
    ' Check if all required fields are filled
    If txtH.Text = "" Or txtH1.Text = "" Or txtMu.Text = "" Or _
       txtGammaSoil.Text = "" Or txtPhi.Text = "" Or txtQa.Text = "" Or _
       txtGammaCon.Text = "" Or txtCover.Text = "" Or _
       txtMaxIter.Text = "" Or txtTrials.Text = "" Then
        Exit Function
    End If
    
    ' Check if values are numeric
    If Not IsNumeric(txtH.Text) Then Exit Function
    If Not IsNumeric(txtH1.Text) Then Exit Function
    If Not IsNumeric(txtMu.Text) Then Exit Function
    If Not IsNumeric(txtGammaSoil.Text) Then Exit Function
    If Not IsNumeric(txtPhi.Text) Then Exit Function
    If Not IsNumeric(txtQa.Text) Then Exit Function
    If Not IsNumeric(txtGammaCon.Text) Then Exit Function
    If Not IsNumeric(txtCover.Text) Then Exit Function
    If Not IsNumeric(txtMaxIter.Text) Then Exit Function
    If Not IsNumeric(txtTrials.Text) Then Exit Function
    
    ' Check if values are in valid range
    If CDbl(txtH.Text) <= 0 Then Exit Function
    If CDbl(txtH1.Text) <= 0 Then Exit Function
    If CDbl(txtMu.Text) <= 0 Then Exit Function
    If CDbl(txtGammaSoil.Text) <= 0 Then Exit Function
    If CDbl(txtPhi.Text) <= 0 Or CDbl(txtPhi.Text) > 45 Then Exit Function
    If CDbl(txtQa.Text) <= 0 Then Exit Function
    If CDbl(txtGammaCon.Text) <= 0 Then Exit Function
    If CDbl(txtCover.Text) <= 0 Then Exit Function
    If CLng(txtMaxIter.Text) <= 0 Then Exit Function
    If CInt(txtTrials.Text) <= 0 Then Exit Function
    
    ValidateInputs = True
End Function

' ========================================
' Clear Button Click Event
' ========================================
Private Sub cmdClear_Click()
    lstResults.Clear
    Call ClearGraph(picGraph)
End Sub

' ========================================
' Form Resize Event (Optional)
' ========================================
Private Sub Form_Resize()
    ' Handle form resize if needed
End Sub

'================================================================================
' [4] cmdCompare_Click - Compare HCA vs BA with Shared Initial Solution
'================================================================================
Private Sub cmdCompare_Click()
    ' NEW compare mode: use already stored standalone-run results
    
    If Not hcaHasRun Then
        MsgBox "Please run HCA first!", vbExclamation
        Exit Sub
    End If
    
    If Not baHasRun Then
        MsgBox "Please run BA first!", vbExclamation
        Exit Sub
    End If
    
    Dim graphMaxIter As Long
    If hcaStoredMaxIter <= baStoredMaxIter Then
        graphMaxIter = hcaStoredMaxIter
    Else
        graphMaxIter = baStoredMaxIter
    End If
    
    ' Draw graph from stored histories
    Call DrawDualCostGraph(picGraph, _
                           hcaStoredHistory, hcaStoredMaxIter, hcaStoredBestIter, _
                           baStoredHistory, baStoredMaxIter, baStoredBestIter)
    
    ' Display compare results
    lstResults.Clear
    lstResults.AddItem "============================================="
    lstResults.AddItem "COMPARE: HCA vs BA"
    lstResults.AddItem "============================================="
    lstResults.AddItem ""
    lstResults.AddItem "HCA (Blue Line):"
    lstResults.AddItem " - Best at Iteration: " & hcaStoredBestIter
    lstResults.AddItem " - Best Cost: " & Format(hcaStoredBestCost, "#,##0.00") & " Baht/m"
    lstResults.AddItem ""
    lstResults.AddItem "BA (Green Line):"
    lstResults.AddItem " - Best at Iteration: " & baStoredBestIter
    lstResults.AddItem " - Best Cost: " & Format(baStoredBestCost, "#,##0.00") & " Baht/m"
    lstResults.AddItem ""
    lstResults.AddItem "Graph Iteration Limit: " & graphMaxIter
    lstResults.AddItem "============================================="
    
    ' Compare by convergence speed (iteration)
    If hcaStoredBestIter < baStoredBestIter Then
        lstResults.AddItem "Result: HCA wins! (faster convergence)"
        lstResults.AddItem "HCA found best at iter " & hcaStoredBestIter & " vs BA at iter " & baStoredBestIter
    ElseIf baStoredBestIter < hcaStoredBestIter Then
        lstResults.AddItem "Result: BA wins! (faster convergence)"
        lstResults.AddItem "BA found best at iter " & baStoredBestIter & " vs HCA at iter " & hcaStoredBestIter
    Else
        lstResults.AddItem "Result: Tie! Both found best at iteration " & hcaStoredBestIter
    End If
    
    lstResults.AddItem "============================================="
End Sub

'================================================================================
' [5] DrawDualCostGraph - Copy ทั้ง Sub ไปวางใน Form1
'================================================================================
Private Sub DrawDualCostGraph(pic As PictureBox, _
                              HCA_History() As Double, HCA_Iter As Long, HCA_BestIter As Long, _
                              BA_History() As Double, BA_Iter As Long, BA_BestIter As Long)
    
    Dim i As Long
    Dim xScale As Double, yScale As Double
    Dim xPos As Double, yPos As Double
    Dim minCost As Double, maxCost As Double
    Dim maxIter As Long
    Dim marginLeft As Single, marginRight As Single
    Dim marginTop As Single, marginBottom As Single
    Dim graphWidth As Single, graphHeight As Single
    Dim lastX As Single, lastY As Single
    Dim firstPoint As Boolean
    Dim gridLines As Integer
    Dim labelValue As Double
    Dim legendX As Single, legendY As Single
    
    ' === Margins ===
    marginLeft = 800
    marginRight = 150
    marginTop = 400
    marginBottom = 500
    
    graphWidth = pic.ScaleWidth - marginLeft - marginRight
    graphHeight = pic.ScaleHeight - marginTop - marginBottom
    
    ' === หา Max Iterations ===
    maxIter = HCA_Iter
    If BA_Iter > maxIter Then maxIter = BA_Iter
    
    ' === หา Min/Max Cost จากทั้ง 2 arrays ===
    minCost = 999999999
    maxCost = 0
    
    ' Scan HCA
    For i = 1 To HCA_Iter
        If HCA_History(i) > 0 And HCA_History(i) < 999000 Then
            If HCA_History(i) < minCost Then minCost = HCA_History(i)
            If HCA_History(i) > maxCost Then maxCost = HCA_History(i)
        End If
    Next i
    
    ' Scan BA
    For i = 1 To BA_Iter
        If BA_History(i) > 0 And BA_History(i) < 999000 Then
            If BA_History(i) < minCost Then minCost = BA_History(i)
            If BA_History(i) > maxCost Then maxCost = BA_History(i)
        End If
    Next i
    
    ' === ปรับ Range ให้มี padding ===
    If maxCost - minCost < 1000 Then
        minCost = minCost - 500
        maxCost = maxCost + 500
    End If
    minCost = minCost * 0.95
    maxCost = maxCost * 1.05
    
    ' ป้องกัน Division by Zero
    If maxCost <= minCost Then maxCost = minCost + 1000
    If maxIter <= 0 Then maxIter = 1
    
    ' === Calculate Scales ===
    xScale = graphWidth / maxIter
    yScale = graphHeight / (maxCost - minCost)
    
    ' === Clear and Draw Background ===
    pic.Cls
    pic.BackColor = vbWhite
    
    ' === Draw Grid Lines ===
    pic.ForeColor = &HE0E0E0  ' Light gray
    pic.DrawWidth = 1
    gridLines = 5
    
    ' Horizontal grid lines
    For i = 0 To gridLines
        yPos = marginTop + graphHeight - (graphHeight * i / gridLines)
        pic.Line (marginLeft, yPos)-(marginLeft + graphWidth, yPos)
    Next i
    
    ' Vertical grid lines
    For i = 1 To 4
        xPos = marginLeft + (graphWidth * i / 4)
        pic.Line (xPos, marginTop)-(xPos, marginTop + graphHeight)
    Next i
    
    ' === Draw Axes ===
    pic.ForeColor = vbBlack
    pic.DrawWidth = 2
    pic.Line (marginLeft, marginTop)-(marginLeft, marginTop + graphHeight)
    pic.Line (marginLeft, marginTop + graphHeight)-(marginLeft + graphWidth, marginTop + graphHeight)
    
    ' === Draw Y-axis Labels ===
    pic.ForeColor = vbBlack
    pic.FontSize = 8
    pic.FontBold = False
    For i = 0 To gridLines
        yPos = marginTop + graphHeight - (graphHeight * i / gridLines)
        labelValue = minCost + (maxCost - minCost) * i / gridLines
        pic.CurrentX = 50
        pic.CurrentY = yPos - 80
        pic.Print Format(labelValue, "#,##0")
    Next i
    
    ' === Draw X-axis Labels ===
    pic.FontSize = 8
    For i = 0 To 4
        xPos = marginLeft + (graphWidth * i / 4)
        pic.CurrentX = xPos - 150
        pic.CurrentY = marginTop + graphHeight + 100
        pic.Print Format(maxIter * i / 4, "#,##0")
    Next i
    
    ' === Draw Axis Titles ===
    pic.FontSize = 9
    pic.FontBold = True
    pic.CurrentX = 30
    pic.CurrentY = marginTop + graphHeight / 2 - 200
    pic.Print "Cost"
    pic.CurrentX = 20
    pic.CurrentY = marginTop + graphHeight / 2
    pic.Print "(Baht/m)"
    pic.CurrentX = marginLeft + graphWidth / 2 - 300
    pic.CurrentY = marginTop + graphHeight + 300
    pic.Print "Iteration"
    
    ' === Draw HCA Line (Blue) ===
    pic.ForeColor = vbBlue
    pic.DrawWidth = 2
    firstPoint = True
    
    For i = 1 To HCA_Iter
        If HCA_History(i) > 0 And HCA_History(i) < 999000 Then
            xPos = marginLeft + (i * xScale)
            yPos = marginTop + graphHeight - ((HCA_History(i) - minCost) * yScale)
            If yPos < marginTop Then yPos = marginTop
            If yPos > marginTop + graphHeight Then yPos = marginTop + graphHeight
            
            If firstPoint Then
                firstPoint = False
            Else
                pic.Line (lastX, lastY)-(xPos, yPos)
            End If
            lastX = xPos
            lastY = yPos
        End If
    Next i
    
    ' แก้เป็น:
pic.ForeColor = vbGreen  ' Dark Green
    pic.DrawWidth = 2
    firstPoint = True
    
    For i = 1 To BA_Iter
        If BA_History(i) > 0 And BA_History(i) < 999000 Then
            xPos = marginLeft + (i * xScale)
            yPos = marginTop + graphHeight - ((BA_History(i) - minCost) * yScale)
            If yPos < marginTop Then yPos = marginTop
            If yPos > marginTop + graphHeight Then yPos = marginTop + graphHeight
            
            If firstPoint Then
                firstPoint = False
            Else
                pic.Line (lastX, lastY)-(xPos, yPos)
            End If
            lastX = xPos
            lastY = yPos
        End If
    Next i
    
    ' === Draw Legend Box ===
    legendX = marginLeft + graphWidth - 1200
    legendY = marginTop + 100
    
    pic.FillStyle = 0
    pic.FillColor = &HFAFAFA
    pic.ForeColor = &HC0C0C0
    pic.DrawWidth = 1
    pic.Line (legendX, legendY)-(legendX + 1100, legendY + 500), , B
    
    ' HCA Legend
    pic.ForeColor = vbBlue
    pic.DrawWidth = 3
    pic.Line (legendX + 50, legendY + 150)-(legendX + 250, legendY + 150)
    pic.ForeColor = vbBlack
    pic.FontSize = 9
    pic.FontBold = True
    pic.CurrentX = legendX + 300
    pic.CurrentY = legendY + 100
    pic.Print "HCA"
    
    ' BA Legend
    pic.ForeColor = vbGreen
    pic.DrawWidth = 3
    pic.Line (legendX + 50, legendY + 350)-(legendX + 250, legendY + 350)
    pic.ForeColor = vbBlack
    pic.CurrentX = legendX + 300
    pic.CurrentY = legendY + 300
    pic.Print "BA"
    
    ' === Draw Title ===
    pic.ForeColor = vbBlack
    pic.FontSize = 12
    pic.FontBold = True
    pic.CurrentX = marginLeft + graphWidth / 2 - 1000
    pic.CurrentY = 80
    pic.Print "Cost Comparison: HCA vs BA"
    
    ' Reset
    pic.FontBold = False
    pic.FillStyle = 1
    pic.DrawWidth = 1
    
End Sub


'================================================================================
' [6] สร้างปุ่ม cmdCompare ใน Form Designer
'================================================================================
' Properties:
'   Name = cmdCompare
'   Caption = Compare Graph
'   Width = 1500
'   Height = 400
'================================================================================

