Attribute VB_Name = "modBA"
'================================================================================
' Module: modBA.bas
' Project: RC_RT_HCA v2.8 - Cantilever Retaining Wall Optimization
' ?????????: ?????????????????? (Bisection Algorithm - BA) - ???¡?? functions ?? modShared
'??????: 3.1 - Triple Bisection + ???????????????? CSV
'?????: 2567

'?????÷?????????? 3#:
'Triple Bisection: ???????? Base, TBase, ??? tb ?¡????????? (Bisection) ??????????þ??????

'HCA-style: ??????????????????? (tt, LToe) ??????????????????????? 6 ?????

'Constraint (??????): ??????? tt <= tb (???? Clamp ??????????????????)

'Inner Loop: ??? 20 ? Countloop ?? (????????????????? ??????÷? Bisection)

'????????????? (Mid): ????????????? HCA ???????????????????? (Max)

'??û???????????? 3.1:
'??? CSV Export: ???????????????? HCA ?????ä?????????????? ????????µ????????????? (Check Valid)

'?????????????? (Rejected): ???????????????????????? ??????????????? (999999999) ??????
'================================================================================
Option Explicit

'================================================================================
' SECTION 1: Module-Level Variables
'================================================================================

' Current Design Indices (????? HCA)
Private Currenttt As Integer
Private Currenttb As Integer
Private CurrentTBase As Integer
Private CurrentBase As Integer
Private CurrentLToe As Integer
Private CurrentStemDB As Integer
Private CurrentStemSP As Integer
Private CurrentToeDB As Integer
Private CurrentToeSP As Integer
Private CurrentHeelDB As Integer
Private CurrentHeelSP As Integer

' Bisection Variables (????? Base)
Private MinBase As Integer      ' Index ??????? Base
Private MaxBase As Integer      ' Index **??????** Base
Private MidBase As Integer      ' Index **?????** Base
Private MidPrice As Double      ' ???? MidBase

' Bisection Variables (?????? TBase) - v2.0
Private MinTBase As Integer     ' Index ????????? TBase
Private MaxTBase As Integer     ' Index ????????? TBase
Private MidTBase As Integer     ' Index ??????? TBase
Private MidPriceTBase As Double ' ??????? MidTBase

' Bisection Variables (?????? tb) - v3.0
Private Mintb As Integer        ' Index ????????? tb
Private Maxtb As Integer        ' Index ????????? tb
Private Midtb As Integer        ' Index ??????? tb
Private MidPricetb As Double    ' ??????? Midtb

' Loop Counters
Private Countloop As Long
Private totalcount As Long

' CSV Export
Private csvAcceptData As String
Private csvLoopData As String
Private loopCount As Long
Private bestIterationInRun As Long

' Tracking (?????????? modDataStructures)
Public CostHistory_BA() As Double

'================================================================================
' SECTION 1.5: Helper Functions (**???¡?? Form1**)
'================================================================================

'--------------------------------------------------------------------------------
' Get Concrete Price by f'c (Maha Sarakham Province)
'--------------------------------------------------------------------------------
Public Function GetConcretePrice_BA(fc As Integer) As Double
    GetConcretePrice_BA = modShared.GetConcretePrice(fc)
End Function

'--------------------------------------------------------------------------------
' Get SD40 Material Properties
'--------------------------------------------------------------------------------
Public Function GetSD40Material_BA(fc As Integer, _
                                   concPrice As Double, _
                                   steelPrice As Double) As MaterialProperties
    GetSD40Material_BA = modShared.GetSD40Material(fc, concPrice, steelPrice)
End Function

'--------------------------------------------------------------------------------
' Steel Price Constant
'--------------------------------------------------------------------------------
Public Const STEEL_PRICE_SD40_BA As Double = 24  ' Baht/kg

'================================================================================
' SECTION 2: Initialize Design (Mid values - **????? HCA**)
' v3.0: **????** tb Bisection bounds
'================================================================================

Private Sub InitializeCurrentDesign_BA()
    Dim tb_max_idx As Integer, TBase_max_idx As Integer
    Dim Base_min_idx As Integer, Base_max_idx As Integer
    Dim LToe_min_idx As Integer, LToe_max_idx As Integer
    Dim i As Integer
    
    ' === tb: ?? Min/Max Index ??? constraint tb <= 0.12H ===
    ' v3.0: ??????? Bisection bounds ?????? tb
    tb_max_idx = tb_max
    For i = tb_max To TB_MIN Step -1
        If WP_tb(i) <= 0.12 * modShared.H Then
            tb_max_idx = i
            Exit For
        End If
    Next i
    
    ' ??????? tb Bisection bounds
    Mintb = TB_MIN
    Maxtb = tb_max_idx
    Midtb = (Mintb + Maxtb) / 2
    Currenttb = Midtb
    
   ' === tt: ???????????? ???? <= tb ===
'Currenttt = (TT_MIN + TT_MAX) / 2

' === tt: ???????? Max ???? <= tb ===
Currenttt = TT_MAX
For i = TT_MAX To TT_MIN Step -1
    If WP_tt(i) <= WP_tb(Currenttb) Then
        Currenttt = i
        Exit For
    End If
Next i

    If Currenttt < TT_MIN Then Currenttt = TT_MIN
    If Currenttt > TT_MAX Then Currenttt = TT_MAX
    ' Constraint: tt <= tb
    If WP_tt(Currenttt) > WP_tb(Currenttb) Then
        For i = TT_MAX To TT_MIN Step -1
            If WP_tt(i) <= WP_tb(Currenttb) Then
                Currenttt = i
                Exit For
            End If
        Next i
    End If
    
    ' === TBase: ?? Max Index ??? constraint TBase <= 0.15H ===
    ' v2.0: ??????? Bisection bounds ?????? TBase
    TBase_max_idx = TBase_max
    For i = TBase_max To TBASE_MIN Step -1
        If WP_TBase(i) <= 0.15 * modShared.H Then
            TBase_max_idx = i
            Exit For
        End If
    Next i
    
    ' ??????? TBase Bisection bounds
    MinTBase = TBASE_MIN
    MaxTBase = TBase_max_idx
    MidTBase = (MinTBase + MaxTBase) / 2
    CurrentTBase = MidTBase
    
    ' === Base: ?? Min/Max Index ??? constraint 0.5H <= Base <= 0.7H ===
    Base_min_idx = BASE_MIN
    For i = BASE_MIN To BASE_MAX
        If WP_Base(i) >= 0.5 * modShared.H Then
            Base_min_idx = i
            Exit For
        End If
    Next i
    
    Base_max_idx = BASE_MAX
    For i = BASE_MAX To BASE_MIN Step -1
        If WP_Base(i) <= 0.7 * modShared.H Then
            Base_max_idx = i
            Exit For
        End If
    Next i
    
    ' ??????? Base Bisection bounds
    MinBase = Base_min_idx
    MaxBase = Base_max_idx
    MidBase = (MinBase + MaxBase) / 2
    CurrentBase = MidBase
    
    ' === LToe: ?? Min/Max Index ??? constraint 0.1H <= LToe <= 0.2H ===
    LToe_min_idx = LTOE_MIN
    For i = LTOE_MIN To LTOE_MAX
        If WP_LToe(i) >= 0.1 * modShared.H Then
            LToe_min_idx = i
            Exit For
        End If
    Next i
    
    LToe_max_idx = LTOE_MAX
    For i = LTOE_MAX To LTOE_MIN Step -1
        If WP_LToe(i) <= 0.2 * modShared.H Then
            LToe_max_idx = i
            Exit For
        End If
    Next i
    
    ' ???????????????
    CurrentLToe = (LToe_min_idx + LToe_max_idx) / 2
    
    ' === ?????: ??????????????? ===
    CurrentStemDB = (DB_MIN + DB_MAX) / 2
    CurrentStemSP = (SP_MIN + SP_MAX) / 2
    CurrentToeDB = (DB_MIN + DB_MAX) / 2
    CurrentToeSP = (SP_MIN + SP_MAX) / 2
    CurrentHeelDB = (DB_MIN + DB_MAX) / 2
    CurrentHeelSP = (SP_MIN + SP_MAX) / 2
    
End Sub

'================================================================================
' SECTION 3: Get Design from Current Indices
'================================================================================

Private Function GetDesignFromCurrent_BA() As Design
    Dim d As Design
    
    d.tt = WP_tt(Currenttt)
    d.tb = WP_tb(Currenttb)
    d.TBase = WP_TBase(CurrentTBase)
    d.Base = WP_Base(CurrentBase)
    d.LToe = WP_LToe(CurrentLToe)
    d.LHeel = d.Base - d.LToe - d.tb
    
    ' Steel indices
    d.ASst_DB = CurrentStemDB
    d.ASst_Sp = CurrentStemSP
    d.AStoe_DB = CurrentToeDB
    d.AStoe_Sp = CurrentToeSP
    d.ASheel_DB = CurrentHeelDB
    d.ASheel_Sp = CurrentHeelSP
    
    GetDesignFromCurrent_BA = d
End Function

'================================================================================
' SECTION 4: Generate Neighbor (????????????? - HCA Style)
' v3.0: tb ??????? [Mintb, Maxtb] ??? tt <= tb
'================================================================================

Private Sub GenerateNeighbor_BA(ByRef Newtt As Integer, ByRef Newtb As Integer, _
                                ByRef NewTBase As Integer, ByRef NewBase As Integer, _
                                ByRef NewLToe As Integer, _
                                ByRef NewStemDB As Integer, ByRef NewStemSP As Integer, _
                                ByRef NewToeDB As Integer, ByRef NewToeSP As Integer, _
                                ByRef NewHeelDB As Integer, ByRef NewHeelSP As Integer)
    
    Dim Step As Integer
    Dim LToe_min_idx As Integer, LToe_max_idx As Integer
    Dim i As Integer
    
    ' === ????? LToe constraint indices ===
    LToe_min_idx = LTOE_MIN
    For i = LTOE_MIN To LTOE_MAX
        If WP_LToe(i) >= 0.1 * modShared.H Then
            LToe_min_idx = i
            Exit For
        End If
    Next i
    
    LToe_max_idx = LTOE_MAX
    For i = LTOE_MAX To LTOE_MIN Step -1
        If WP_LToe(i) <= 0.2 * modShared.H Then
            LToe_max_idx = i
            Exit For
        End If
    Next i
    
    ' === tb: step = Rand(-1, 1) ?????????? [Mintb, Maxtb] ===
    ' v3.0: ??? Bisection bounds
    Step = Rand(-1, 1)
    Newtb = Currenttb + Step
    If Newtb < Mintb Then Newtb = Mintb
    If Newtb > Maxtb Then Newtb = Maxtb
    
    ' === tt: step = Rand(-2, 2) ??????? <= tb ===
    ' v3.0: Constraint tt <= tb
    Step = Rand(-2, 2)
    Newtt = Currenttt + Step
    If Newtt < TT_MIN Then Newtt = TT_MIN
    If Newtt > TT_MAX Then Newtt = TT_MAX
    
    ' Clamp tt ??? <= tb (????????!)
    If WP_tt(Newtt) > WP_tb(Newtb) Then
        ' ?? tt index ??????????????? <= tb
        For i = TT_MAX To TT_MIN Step -1
            If WP_tt(i) <= WP_tb(Newtb) Then
                Newtt = i
                Exit For
            End If
        Next i
    End If
    
    ' === TBase: step = Rand(-1, 1) ?????????? [MinTBase, MaxTBase] ===
    ' v2.0: ??? Bisection bounds
    Step = Rand(-1, 1)
    NewTBase = CurrentTBase + Step
    If NewTBase < MinTBase Then NewTBase = MinTBase
    If NewTBase > MaxTBase Then NewTBase = MaxTBase
    
    ' === LToe: step = Rand(-2, 2) ===
    Step = Rand(-2, 2)
    NewLToe = CurrentLToe + Step
    If NewLToe < LToe_min_idx Then NewLToe = LToe_min_idx
    If NewLToe > LToe_max_idx Then NewLToe = LToe_max_idx
    
    ' === Base: step = Rand(-1, 1) ?????????? [MinBase, MaxBase] ===
    Step = Rand(-1, 1)
    NewBase = CurrentBase + Step
    If NewBase < MinBase Then NewBase = MinBase
    If NewBase > MaxBase Then NewBase = MaxBase
    
    ' === ?????: step = Rand(-2, 2) ===
    
    Step = Rand(-2, 2)
    NewStemDB = CurrentStemDB + Step
    If NewStemDB < DB_MIN Then NewStemDB = DB_MIN
    If NewStemDB > DB_MAX Then NewStemDB = DB_MAX
    
    Step = Rand(-2, 2)
    NewStemSP = CurrentStemSP + Step
    If NewStemSP < SP_MIN Then NewStemSP = SP_MIN
    If NewStemSP > SP_MAX Then NewStemSP = SP_MAX
    
    Step = Rand(-2, 2)
    NewToeDB = CurrentToeDB + Step
    If NewToeDB < DB_MIN Then NewToeDB = DB_MIN
    If NewToeDB > DB_MAX Then NewToeDB = DB_MAX
    
    Step = Rand(-2, 2)
    NewToeSP = CurrentToeSP + Step
    If NewToeSP < SP_MIN Then NewToeSP = SP_MIN
    If NewToeSP > SP_MAX Then NewToeSP = SP_MAX
    
    Step = Rand(-2, 2)
    NewHeelDB = CurrentHeelDB + Step
    If NewHeelDB < DB_MIN Then NewHeelDB = DB_MIN
    If NewHeelDB > DB_MAX Then NewHeelDB = DB_MAX
    
    Step = Rand(-2, 2)
    NewHeelSP = CurrentHeelSP + Step
    If NewHeelSP < SP_MIN Then NewHeelSP = SP_MIN
    If NewHeelSP > SP_MAX Then NewHeelSP = SP_MAX
    
End Sub

'================================================================================
' SECTION 5: Main Bisection Optimization Function
' v3.1: Triple Bisection + Fixed CSV Export
'================================================================================

Public Function BisectionOptimization(MaxIterations As Long, _
                       wall_height As Double, _
                       backfill_height As Double, _
                       soil_gamma As Double, _
                       concrete_gamma As Double, _
                       friction_angle As Double, _
                       friction_coef As Double, _
                       allowable_bearing As Double, _
                       concrete_cover As Double, _
                       material As MaterialProperties, _
                       Optional useSharedInit As Boolean = False, _
                       Optional sharedTt As Integer = 0, _
                       Optional sharedTb As Integer = 0, _
                       Optional sharedTBase As Integer = 0, _
                       Optional sharedBase As Integer = 0, _
                       Optional sharedLToe As Integer = 0, _
                       Optional sharedStemDB As Integer = 0, _
                       Optional sharedStemSP As Integer = 0, _
                       Optional sharedToeDB As Integer = 0, _
                       Optional sharedToeSP As Integer = 0, _
                       Optional sharedHeelDB As Integer = 0, _
                       Optional sharedHeelSP As Integer = 0) As Design
    
    Dim current As Design, neighbor As Design, best As Design
    Dim CurrentPrice As Double, NewPrice As Double, best_cost As Double
    Dim iteration As Long, innerIterations As Long, i As Long
    Dim FS_OT As Double, FS_SL As Double, FS_BC As Double
    Dim is_valid As Boolean
    
    ' New indices
    Dim Newtt As Integer, Newtb As Integer, NewTBase As Integer
    Dim NewBase As Integer, NewLToe As Integer
    Dim NewStemDB As Integer, NewStemSP As Integer
    Dim NewToeDB As Integer, NewToeSP As Integer
    Dim NewHeelDB As Integer, NewHeelSP As Integer
    
    ' Backup indices
    Dim Backuptt As Integer, Backuptb As Integer, BackupTBase As Integer
    Dim BackupBase As Integer, BackupLToe As Integer
    Dim BackupStemDB As Integer, BackupStemSP As Integer
    Dim BackupToeDB As Integer, BackupToeSP As Integer
    Dim BackupHeelDB As Integer, BackupHeelSP As Integer
    
    ' === Set modShared variables ===
    modShared.H = wall_height
    modShared.H1 = backfill_height
    modShared.gamma_soil = soil_gamma
    modShared.gamma_concrete = concrete_gamma
    modShared.phi = friction_angle
    modShared.mu = friction_coef
    modShared.qa = allowable_bearing
    modShared.cover = concrete_cover
    modShared.currentMaterial = material
    modShared.currentWSD = CalculateWSDParameters(material.fy, material.fc)
    
    ' === Initialize ===
    Call modShared.InitializeArrays
    ReDim CostHistory_BA(1 To MaxIterations)
    Randomize Timer
    Call InitCSVExport_BA
    
    ' === Initialize Counters ===
    Countloop = 0
    totalcount = 0
    MidPrice = 999999999
    MidPriceTBase = 999999999
    MidPricetb = 999999999
    
    ' === Initial Design ===
    If useSharedInit Then
        ' Compute bisection bounds from constraints (same as InitializeCurrentDesign_BA)
        Dim tb_max_idx_s As Integer, TBase_max_idx_s As Integer
        Dim Base_min_idx_s As Integer, Base_max_idx_s As Integer
        Dim ii As Integer
        
        tb_max_idx_s = tb_max
        For ii = tb_max To TB_MIN Step -1
            If WP_tb(ii) <= 0.12 * modShared.H Then
                tb_max_idx_s = ii
                Exit For
            End If
        Next ii
        Mintb = TB_MIN
        Maxtb = tb_max_idx_s
        
        TBase_max_idx_s = TBase_max
        For ii = TBase_max To TBASE_MIN Step -1
            If WP_TBase(ii) <= 0.15 * modShared.H Then
                TBase_max_idx_s = ii
                Exit For
            End If
        Next ii
        MinTBase = TBASE_MIN
        MaxTBase = TBase_max_idx_s
        
        Base_min_idx_s = BASE_MIN
        For ii = BASE_MIN To BASE_MAX
            If WP_Base(ii) >= 0.5 * modShared.H Then
                Base_min_idx_s = ii
                Exit For
            End If
        Next ii
        Base_max_idx_s = BASE_MAX
        For ii = BASE_MAX To BASE_MIN Step -1
            If WP_Base(ii) <= 0.7 * modShared.H Then
                Base_max_idx_s = ii
                Exit For
            End If
        Next ii
        MinBase = Base_min_idx_s
        MaxBase = Base_max_idx_s
        
        ' Set Mid values from shared indices
        Midtb = sharedTb
        MidTBase = sharedTBase
        MidBase = sharedBase
        
        ' Clamp Mid within bounds
        If Midtb < Mintb Then Midtb = Mintb
        If Midtb > Maxtb Then Midtb = Maxtb
        If MidTBase < MinTBase Then MidTBase = MinTBase
        If MidTBase > MaxTBase Then MidTBase = MaxTBase
        If MidBase < MinBase Then MidBase = MinBase
        If MidBase > MaxBase Then MidBase = MaxBase
        
        ' Set all Current values from shared
        Currenttt = sharedTt
        Currenttb = sharedTb
        CurrentTBase = sharedTBase
        CurrentBase = sharedBase
        CurrentLToe = sharedLToe
        CurrentStemDB = sharedStemDB
        CurrentStemSP = sharedStemSP
        CurrentToeDB = sharedToeDB
        CurrentToeSP = sharedToeSP
        CurrentHeelDB = sharedHeelDB
        CurrentHeelSP = sharedHeelSP
    Else
        Call InitializeCurrentDesign_BA
    End If
    current = GetDesignFromCurrent_BA()
    
    ' Debug: ??????? Initial Design
    Debug.Print "=== BA v3.1 OPTIMIZATION START (Triple Bisection + Fixed CSV) ==="
    Debug.Print "--- Initial Design (Mid values) ---"
    Debug.Print "tt=" & Format(current.tt, "0.00") & ", tb=" & Format(current.tb, "0.00") & _
                ", TBase=" & Format(current.TBase, "0.00") & ", Base=" & Format(current.Base, "0.00")
    Debug.Print "LToe=" & Format(current.LToe, "0.00") & ", LHeel=" & Format(current.LHeel, "0.00")
    Debug.Print "Base Bisection: Min=" & MinBase & ", Max=" & MaxBase & ", Mid=" & MidBase
    Debug.Print "TBase Bisection: Min=" & MinTBase & ", Max=" & MaxTBase & ", Mid=" & MidTBase
    Debug.Print "tb Bisection: Min=" & Mintb & ", Max=" & Maxtb & ", Mid=" & Midtb
    
    ' v3.1: ????????????? ???????? Check Valid (?????? HCA)
    CurrentPrice = CalculateCostFull(current, CurrentStemDB, CurrentStemSP, _
                                 CurrentToeDB, CurrentToeSP, _
                                 CurrentHeelDB, CurrentHeelSP)
    
    is_valid = CheckDesignValid(current, CurrentStemDB, CurrentStemSP, _
                                CurrentToeDB, CurrentToeSP, _
                                CurrentHeelDB, CurrentHeelSP, _
                                FS_OT, FS_SL, FS_BC)
    
    Debug.Print "FS_OT=" & Format(FS_OT, "0.00") & ", FS_SL=" & Format(FS_SL, "0.00") & _
                ", FS_BC=" & Format(FS_BC, "0.00") & ", Valid=" & is_valid
    
    If is_valid Then
        best = current
        best_cost = CurrentPrice
        modDataStructures.BestCostIteration = 1
        Debug.Print "=== BA Initial Design VALID, Cost = " & Format(best_cost, "#,##0") & " Baht/m ==="
        ' v3.1: Log Initial Design ???? "Passed and Better value"
        Call LogIteration_BA(0, CurrentPrice, True, True)
    Else
        best_cost = 999999999
        modDataStructures.BestCostIteration = 0
        Debug.Print "=== BA Initial Design INVALID, searching... ==="
        ' v3.1: Log Initial Design ???? "Rejected" ?????????????
        Call LogIteration_BA(0, CurrentPrice, False, False)
    End If
    
    ' === Main Bisection Loop ===
    Do While totalcount < MaxIterations
        Countloop = Countloop + 1
        innerIterations = 20 * Countloop
        
        ' ??? innerIterations ???? iterations ???????? ?????????
        If totalcount + innerIterations > MaxIterations Then
            innerIterations = MaxIterations - totalcount
        End If
        
        Debug.Print "--- Outer Loop #" & Countloop & " (Inner=" & innerIterations & ") ---"
        Debug.Print "  Base: Mid=" & MidBase & " (" & Format(WP_Base(MidBase), "0.00") & "m)"
        Debug.Print "  TBase: Mid=" & MidTBase & " (" & Format(WP_TBase(MidTBase), "0.00") & "m)"
        Debug.Print "  tb: Mid=" & Midtb & " (" & Format(WP_tb(Midtb), "0.00") & "m)"
        
        ' === Reset Current values ?????? Outer Loop ===
        CurrentBase = MidBase
        CurrentTBase = MidTBase
        Currenttb = Midtb
        
        ' ???? clamp tt ??? <= tb ???? reset
        If WP_tt(Currenttt) > WP_tb(Currenttb) Then
            Dim j As Integer
            For j = TT_MAX To TT_MIN Step -1
                If WP_tt(j) <= WP_tb(Currenttb) Then
                    Currenttt = j
                    Exit For
                End If
            Next j
        End If
        
        current = GetDesignFromCurrent_BA()
        
        ' v3.1: ?????????????
        CurrentPrice = CalculateCostFull(current, CurrentStemDB, CurrentStemSP, _
                                     CurrentToeDB, CurrentToeSP, _
                                     CurrentHeelDB, CurrentHeelSP)
        
        is_valid = CheckDesignValid(current, CurrentStemDB, CurrentStemSP, _
                                    CurrentToeDB, CurrentToeSP, _
                                    CurrentHeelDB, CurrentHeelSP, _
                                    FS_OT, FS_SL, FS_BC)
        
        If Not is_valid Then
            CurrentPrice = 999999999
        End If
        
        ' === Inner Loop (HCA-style) ===
        For i = 1 To innerIterations
            totalcount = totalcount + 1
            If totalcount > MaxIterations Then Exit For
            
            ' Backup current indices
            Backuptt = Currenttt: Backuptb = Currenttb: BackupTBase = CurrentTBase
            BackupBase = CurrentBase: BackupLToe = CurrentLToe
            BackupStemDB = CurrentStemDB: BackupStemSP = CurrentStemSP
            BackupToeDB = CurrentToeDB: BackupToeSP = CurrentToeSP
            BackupHeelDB = CurrentHeelDB: BackupHeelSP = CurrentHeelSP
            
            ' Generate neighbor (?????????????)
            Call GenerateNeighbor_BA(Newtt, Newtb, NewTBase, NewBase, NewLToe, _
                                     NewStemDB, NewStemSP, NewToeDB, NewToeSP, _
                                     NewHeelDB, NewHeelSP)
            
            ' Set new indices
            Currenttt = Newtt: Currenttb = Newtb: CurrentTBase = NewTBase
            CurrentBase = NewBase: CurrentLToe = NewLToe
            CurrentStemDB = NewStemDB: CurrentStemSP = NewStemSP
            CurrentToeDB = NewToeDB: CurrentToeSP = NewToeSP
            CurrentHeelDB = NewHeelDB: CurrentHeelSP = NewHeelSP
            
            neighbor = GetDesignFromCurrent_BA()
            
            ' v3.1: ????????????? Check Valid (?????? HCA)
            NewPrice = CalculateCostFull(neighbor, CurrentStemDB, CurrentStemSP, _
                                      CurrentToeDB, CurrentToeSP, _
                                      CurrentHeelDB, CurrentHeelSP)
            
            is_valid = CheckDesignValid(neighbor, CurrentStemDB, CurrentStemSP, _
                                        CurrentToeDB, CurrentToeSP, _
                                        CurrentHeelDB, CurrentHeelSP, _
                                        FS_OT, FS_SL, FS_BC)
            
            If is_valid Then
                ' ????????? Current ? Update Current
                If NewPrice < CurrentPrice Then
                    current = neighbor
                    CurrentPrice = NewPrice
                    
                    ' ????????? Best ? Update Best
                    If CurrentPrice < best_cost Then
                        best = current
                        best_cost = CurrentPrice
                        modDataStructures.BestCostIteration = totalcount
                        Debug.Print ">>> NEW BEST at iteration " & totalcount & ": " & Format(best_cost, "#,##0") & " Baht/m"
                        ' v3.1: Passed and Better value
                        Call LogIteration_BA(totalcount, NewPrice, True, True)
                    Else
                        ' v3.1: Passed ????????? Best
                        Call LogIteration_BA(totalcount, NewPrice, True, False)
                    End If
                Else
                    ' Restore backup
                    Currenttt = Backuptt: Currenttb = Backuptb: CurrentTBase = BackupTBase
                    CurrentBase = BackupBase: CurrentLToe = BackupLToe
                    CurrentStemDB = BackupStemDB: CurrentStemSP = BackupStemSP
                    CurrentToeDB = BackupToeDB: CurrentToeSP = BackupToeSP
                    CurrentHeelDB = BackupHeelDB: CurrentHeelSP = BackupHeelSP
                    ' v3.1: Passed ???????????? current
                    Call LogIteration_BA(totalcount, NewPrice, True, False)
                End If
            Else
                ' Restore backup
                Currenttt = Backuptt: Currenttb = Backuptb: CurrentTBase = BackupTBase
                CurrentBase = BackupBase: CurrentLToe = BackupLToe
                CurrentStemDB = BackupStemDB: CurrentStemSP = BackupStemSP
                CurrentToeDB = BackupToeDB: CurrentToeSP = BackupToeSP
                CurrentHeelDB = BackupHeelDB: CurrentHeelSP = BackupHeelSP
                ' v3.1: Rejected ????????????? (?????? 999999999)
                Call LogIteration_BA(totalcount, NewPrice, False, False)
            End If
            
            ' Update cost history
            If modDataStructures.BestCostIteration > 0 Then
                CostHistory_BA(totalcount) = best_cost
            Else
                CostHistory_BA(totalcount) = 999000
            End If
            
            DoEvents
        Next i
        
        ' =======================================================================
        ' v3.0: TRIPLE BISECTION STEP (?????? Inner Loop)
        ' ?????: tb ? TBase ? Base
        ' =======================================================================
        
        ' === Bisection Step 1: tb (?????????) ===
        Debug.Print "  [tb Bisection] CurrentPrice=" & Format(CurrentPrice, "#,##0") & ", MidPricetb=" & Format(MidPricetb, "#,##0")
        
        If CurrentPrice < MidPricetb Then
            Maxtb = Currenttb
            MidPricetb = CurrentPrice
            Debug.Print "    tb: Better -> Maxtb=" & Maxtb
        Else
            Mintb = Currenttb
            Debug.Print "    tb: Not Better -> Mintb=" & Mintb
        End If
        
        Midtb = (Mintb + Maxtb) / 2
        If Midtb < Mintb Then Midtb = Mintb
        If Midtb > Maxtb Then Midtb = Maxtb
        Debug.Print "    New Midtb=" & Midtb & " (Range: " & Mintb & "-" & Maxtb & ")"
        
        ' === Bisection Step 2: TBase ===
        Debug.Print "  [TBase Bisection] CurrentPrice=" & Format(CurrentPrice, "#,##0") & ", MidPriceTBase=" & Format(MidPriceTBase, "#,##0")
        
        If CurrentPrice < MidPriceTBase Then
            MaxTBase = CurrentTBase
            MidPriceTBase = CurrentPrice
            Debug.Print "    TBase: Better -> MaxTBase=" & MaxTBase
        Else
            MinTBase = CurrentTBase
            Debug.Print "    TBase: Not Better -> MinTBase=" & MinTBase
        End If
        
        MidTBase = (MinTBase + MaxTBase) / 2
        If MidTBase < MinTBase Then MidTBase = MinTBase
        If MidTBase > MaxTBase Then MidTBase = MaxTBase
        Debug.Print "    New MidTBase=" & MidTBase & " (Range: " & MinTBase & "-" & MaxTBase & ")"
        
        ' === Bisection Step 3: Base (?????????) ===
        Debug.Print "  [Base Bisection] CurrentPrice=" & Format(CurrentPrice, "#,##0") & ", MidPrice=" & Format(MidPrice, "#,##0")
        
        If CurrentPrice < MidPrice Then
            MaxBase = CurrentBase
            MidPrice = CurrentPrice
            Debug.Print "    Base: Better -> MaxBase=" & MaxBase
        Else
            MinBase = CurrentBase
            Debug.Print "    Base: Not Better -> MinBase=" & MinBase
        End If
        
        MidBase = (MinBase + MaxBase) / 2
        If MidBase < MinBase Then MidBase = MinBase
        If MidBase > MaxBase Then MidBase = MaxBase
        Debug.Print "    New MidBase=" & MidBase & " (Range: " & MinBase & "-" & MaxBase & ")"
        
    Loop
    
    ' === Complete ===
    Debug.Print "=== BA v3.1 OPTIMIZATION COMPLETE ==="
    If modDataStructures.BestCostIteration > 0 Then
        Debug.Print "Best Cost: " & Format(best_cost, "#,##0") & " Baht/m"
        Debug.Print "Found at Iteration: " & modDataStructures.BestCostIteration
        Debug.Print "Total Outer Loops: " & Countloop
    Else
        Debug.Print "NO VALID DESIGN FOUND!"
    End If
    
    Call SaveAcceptCSV_BA(wall_height)
    
    BisectionOptimization = best
End Function

'================================================================================
' SECTION 6: CSV Export Functions (?????? HCA)
' v3.1: ???????????????????? HCA
'================================================================================

Public Sub InitCSVExport_BA()
    csvAcceptData = "No.,Rejected,Passed,Passed and Better value" & vbCrLf
    bestIterationInRun = 0
End Sub

Public Sub InitLoopCounter_BA()
    csvLoopData = "No.,Loop,BestPrice" & vbCrLf
    loopCount = 0
End Sub

'--------------------------------------------------------------------------------
' v3.1: LogIteration_BA - ???????????? HCA
' - Rejected: ??????? column 2 (Invalid)
' - Passed: ??????? column 3 (Valid ???????????? best)
' - Passed and Better value: ??????? column 4 (Valid ????????? best)
'--------------------------------------------------------------------------------
Public Sub LogIteration_BA(iteration As Long, cost As Double, IsValid As Boolean, isBetter As Boolean)
    If Not IsValid Then
        ' Rejected - ??????? column 2
        csvAcceptData = csvAcceptData & iteration & "," & Format(cost, "0.00") & ",," & vbCrLf
    ElseIf isBetter Then
        ' Passed and Better value - ??????? column 4
        csvAcceptData = csvAcceptData & iteration & ",,," & Format(cost, "0.00") & vbCrLf
        bestIterationInRun = iteration
    Else
        ' Passed - ??????? column 3
        csvAcceptData = csvAcceptData & iteration & ",," & Format(cost, "0.00") & "," & vbCrLf
    End If
End Sub

'--------------------------------------------------------------------------------
' v3.1: LogLoopResult_BA - ???????????? HCA
' ??????: No., Loop (iteration ????? best), BestPrice
'--------------------------------------------------------------------------------
Public Sub LogLoopResult_BA(bestPrice As Double)
    loopCount = loopCount + 1
    csvLoopData = csvLoopData & loopCount & "," & bestIterationInRun & "," & Format(bestPrice, "0.00") & vbCrLf
End Sub

Public Sub SaveAcceptCSV_BA(wallHeight As Double)
    Dim filePath As String, fileNum As Integer
    
    On Error GoTo ErrorHandler
    
    filePath = "D:\accept-BA-H" & Format(wallHeight, "0") & ".csv"
    fileNum = FreeFile
    Open filePath For Output As #fileNum
    Print #fileNum, csvAcceptData;
    Close #fileNum
    Debug.Print "[CSV] Saved: " & filePath
    Exit Sub
    
ErrorHandler:
    Debug.Print "[CSV ERROR] Cannot save: " & filePath
End Sub

Public Sub SaveLoopPriceCSV_BA(wallHeight As Double)
    Dim filePath As String, fileNum As Integer
    
    On Error GoTo ErrorHandler
    
    filePath = "D:\loopPrice-BA-H" & Format(wallHeight, "0") & ".csv"
    fileNum = FreeFile
    Open filePath For Output As #fileNum
    Print #fileNum, csvLoopData;
    Close #fileNum
    Debug.Print "[CSV] Saved: " & filePath
    Exit Sub
    
ErrorHandler:
    Debug.Print "[CSV ERROR] Cannot save: " & filePath
End Sub

'================================================================================
' END OF MODULE: modBA.bas v3.1 - Triple Bisection + Fixed CSV Export
'================================================================================
