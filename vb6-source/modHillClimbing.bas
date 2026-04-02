Attribute VB_Name = "modHillClimbing"
'================================================================================
' Module: modHillClimbing.bas
' Project: RC_RT_HCA v2.8 - Cantilever Retaining Wall Optimization
' Purpose: Hill Climbing Algorithm (HCA) - ???????? functions ??? modShared
' Version: 5.1 - Fixed CSV Export (Rejected ????????????)
' Date: 2567
'
' ??????????? v5.1:
' - ????? CSV Export: ????????????? Check Valid
' - Rejected ???????????? ?????? 999999999
'================================================================================
Option Explicit

'================================================================================
' SECTION 1: Module-Level Variables (?????? HCA)
'================================================================================

' Current Design Indices
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

' Cost History ?????? modDataStructures.CostHistory

' CSV Export
Private csvAcceptData As String
Private csvLoopData As String
Private loopCount As Long
Private bestIterationInRun As Long

'================================================================================
' SECTION 2: Initialize Design (Conservative - Max values)
'================================================================================

Private Sub InitializeCurrentDesign()
    Dim tb_max As Double, TBase_max As Double
    Dim Base_target As Double, LToe_target As Double
    Dim LBase_Max_Ratio As Double
    Dim i As Integer
    
    
    ' === tb: Max = 0.12 × H ===
    tb_max = 0.12 * modShared.H
    Currenttb = TB_MIN
    For i = tb_max To TB_MIN Step -1
        If WP_tb(i) <= tb_max Then
            Currenttb = i
            Exit For
        End If
    Next i
    
    ' === tt: ???????? Max ???? <= tb ===
Currenttt = TT_MAX
For i = TT_MAX To TT_MIN Step -1
    If WP_tt(i) <= WP_tb(Currenttb) Then
        Currenttt = i
        Exit For
    End If
Next i

    ' ???? >= tt
    If WP_tb(Currenttb) < WP_tt(Currenttt) Then
        For i = TB_MIN To tb_max
            If WP_tb(i) >= WP_tt(Currenttt) Then
                Currenttb = i
                Exit For
            End If
        Next i
    End If
    
    ' === TBase: Max = 0.15 × H ===
    TBase_max = 0.15 * modShared.H
    CurrentTBase = TBASE_MIN
    For i = TBase_max To TBASE_MIN Step -1
        If WP_TBase(i) <= TBase_max Then
            CurrentTBase = i
            Exit For
        End If
    Next i
    
    ' === Base: 0.5H - 0.7H ===
    Base_target = 0.7 * modShared.H
    CurrentBase = BASE_MIN
    For i = BASE_MAX To BASE_MIN Step -1
        If WP_Base(i) <= Base_target Then
            CurrentBase = i
            Exit For
        End If
    Next i
    
    ' === LToe: 0.2 × H ===
    LToe_target = 0.2 * modShared.H
    CurrentLToe = LTOE_MIN
    For i = LTOE_MAX To LTOE_MIN Step -1
        If WP_LToe(i) <= LToe_target Then
            CurrentLToe = i
            Exit For
        End If
    Next i
    
    ' === ?????: Max (DB28 @ 0.10m) ===
    CurrentStemDB = DB_MAX:  CurrentStemSP = SP_MIN
    CurrentToeDB = DB_MAX:   CurrentToeSP = SP_MIN
    CurrentHeelDB = DB_MAX:  CurrentHeelSP = SP_MIN
End Sub

'================================================================================
' SECTION 3: Get Design from Current Indices
'================================================================================

Private Function GetDesignFromCurrent() As Design
    Dim d As Design
    
    d.tt = WP_tt(Currenttt)
    d.tb = WP_tb(Currenttb)
    d.TBase = WP_TBase(CurrentTBase)
    d.Base = WP_Base(CurrentBase)
    d.LToe = WP_LToe(CurrentLToe)
    d.LHeel = d.Base - d.LToe - d.tb
    
    ' Steel indices (for reference)
    d.ASst_DB = CurrentStemDB
    d.ASst_Sp = CurrentStemSP
    d.AStoe_DB = CurrentToeDB
    d.AStoe_Sp = CurrentToeSP
    d.ASheel_DB = CurrentHeelDB
    d.ASheel_Sp = CurrentHeelSP
    
    GetDesignFromCurrent = d
End Function

'================================================================================
' SECTION 4: Generate Neighbor (???????????????????)
'================================================================================

Private Sub GenerateNeighbor(ByRef Newtt As Integer, ByRef Newtb As Integer, _
                             ByRef NewTBase As Integer, ByRef NewBase As Integer, _
                             ByRef NewLToe As Integer, _
                             ByRef NewStemDB As Integer, ByRef NewStemSP As Integer, _
                             ByRef NewToeDB As Integer, ByRef NewToeSP As Integer, _
                             ByRef NewHeelDB As Integer, ByRef NewHeelSP As Integer)
    
    Dim Step As Integer
    Dim LBase_Max_Ratio As Double, Base_Max_calc As Double
    Dim LHeel_Max As Double
    
    ' === ????????????? (?????? HCA ???) ===
    
    ' tt: step = Rand(-2, 2)
    Step = Rand(-2, 2)
    Newtt = Currenttt + Step
    If Newtt < TT_MIN Then Newtt = TT_MIN
    If Newtt > TT_MAX Then Newtt = TT_MAX
    
    ' tb: step = Rand(-1, 1)
    Step = Rand(-1, 1)
    Newtb = Currenttb + Step
    If Newtb < TB_MIN Then Newtb = TB_MIN
    If Newtb > tb_max Then Newtb = tb_max
    ' Constraint: tb >= tt
    If WP_tb(Newtb) < WP_tt(Newtt) Then
        Newtb = TB_MIN
        Do While Newtb <= tb_max
            If WP_tb(Newtb) >= WP_tt(Newtt) Then Exit Do
            Newtb = Newtb + 1
        Loop
    End If
    ' Constraint: tb <= 0.12H
    Do While Newtb > TB_MIN And WP_tb(Newtb) > 0.12 * modShared.H
        Newtb = Newtb - 1
    Loop
    
    ' TBase: step = Rand(-1, 1)
    Step = Rand(-1, 1)
    NewTBase = CurrentTBase + Step
    If NewTBase < TBASE_MIN Then NewTBase = TBASE_MIN
    If NewTBase > TBase_max Then NewTBase = TBase_max
    ' Constraint: TBase <= 0.15H
    Do While NewTBase > TBASE_MIN And WP_TBase(NewTBase) > 0.15 * modShared.H
        NewTBase = NewTBase - 1
    Loop
    
    ' LToe: step = Rand(-2, 2)
    Step = Rand(-2, 2)
    NewLToe = CurrentLToe + Step
    If NewLToe < LTOE_MIN Then NewLToe = LTOE_MIN
    If NewLToe > LTOE_MAX Then NewLToe = LTOE_MAX
    ' Constraint: 0.1H <= LToe <= 0.2H
    Do While NewLToe > LTOE_MIN And WP_LToe(NewLToe) > 0.2 * modShared.H
        NewLToe = NewLToe - 1
    Loop
    Do While NewLToe < LTOE_MAX And WP_LToe(NewLToe) < 0.1 * modShared.H
        NewLToe = NewLToe + 1
    Loop
    
    ' Base: step = Rand(-1, 1)
    ' Constraint: 0.5H <= Base <= 0.7H
    Base_Max_calc = 0.7 * modShared.H
    Step = Rand(-1, 1)
    NewBase = CurrentBase + Step
    If NewBase < BASE_MIN Then NewBase = BASE_MIN
    If NewBase > BASE_MAX Then NewBase = BASE_MAX
    ' Constraint: Base >= 0.5H
    Do While NewBase < BASE_MAX And WP_Base(NewBase) < 0.5 * modShared.H
        NewBase = NewBase + 1
    Loop
    ' Constraint: Base <= Base_Max_calc
    Do While NewBase > BASE_MIN And WP_Base(NewBase) > Base_Max_calc
        NewBase = NewBase - 1
    Loop
    
    ' === Steel: step = Rand(-2, 2) ===
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
' SECTION 5: Hill Climbing Algorithm (Main Optimization Function)
' v5.1: Fixed CSV Export - ????????????? Check Valid
'================================================================================

Public Function HillClimbingOptimization(MaxIterations As Long, _
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
    Dim current_cost As Double, neighbor_cost As Double, best_cost As Double
    Dim iteration As Long
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
    ReDim modDataStructures.CostHistory(1 To MaxIterations)
    Randomize Timer
    Call InitCSVExport
    
    ' === Initial Design ===
    If useSharedInit Then
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
        Call InitializeCurrentDesign
    End If
    current = GetDesignFromCurrent()
    
    ' Debug: ??????? Initial Design
    Debug.Print "=== HCA v5.1 OPTIMIZATION START (Fixed CSV) ==="
    Debug.Print "--- Initial Design ---"
    Debug.Print "tt=" & Format(current.tt, "0.00") & ", tb=" & Format(current.tb, "0.00") & _
                ", TBase=" & Format(current.TBase, "0.00") & ", Base=" & Format(current.Base, "0.00")
    Debug.Print "LToe=" & Format(current.LToe, "0.00") & ", LHeel=" & Format(current.LHeel, "0.00")
    
    ' v5.1: ????????????? Check Valid
    Dim estimatedCost As Double
    estimatedCost = CalculateCostFull(current, CurrentStemDB, CurrentStemSP, _
                                  CurrentToeDB, CurrentToeSP, _
                                  CurrentHeelDB, CurrentHeelSP)
    
    is_valid = CheckDesignValid(current, CurrentStemDB, CurrentStemSP, _
                                CurrentToeDB, CurrentToeSP, _
                                CurrentHeelDB, CurrentHeelSP, _
                                FS_OT, FS_SL, FS_BC)
    
    Debug.Print "FS_OT=" & Format(FS_OT, "0.00") & ", FS_SL=" & Format(FS_SL, "0.00") & _
                ", FS_BC=" & Format(FS_BC, "0.00") & ", Valid=" & is_valid
    
    If is_valid Then
        current_cost = estimatedCost
        best = current
        best_cost = current_cost
        modDataStructures.BestCostIteration = 1
        Debug.Print "=== HCA Initial Design VALID, Cost = " & Format(best_cost, "#,##0") & " Baht/m ==="
        Call LogIteration(0, estimatedCost, True, True)
    Else
        current_cost = 999999999
        best_cost = 999999999
        modDataStructures.BestCostIteration = 0
        Debug.Print "=== HCA Initial Design INVALID, searching... ==="
        ' v5.1: Log ???????????? (?????? 999999999)
        Call LogIteration(0, estimatedCost, False, False)
    End If
    
    ' === Hill Climbing Loop ===
    For iteration = 1 To MaxIterations
        
        ' Backup current indices
        Backuptt = Currenttt: Backuptb = Currenttb: BackupTBase = CurrentTBase
        BackupBase = CurrentBase: BackupLToe = CurrentLToe
        BackupStemDB = CurrentStemDB: BackupStemSP = CurrentStemSP
        BackupToeDB = CurrentToeDB: BackupToeSP = CurrentToeSP
        BackupHeelDB = CurrentHeelDB: BackupHeelSP = CurrentHeelSP
        
        ' Generate neighbor
        Call GenerateNeighbor(Newtt, Newtb, NewTBase, NewBase, NewLToe, _
                              NewStemDB, NewStemSP, NewToeDB, NewToeSP, _
                              NewHeelDB, NewHeelSP)
        
        ' Set new indices
        Currenttt = Newtt: Currenttb = Newtb: CurrentTBase = NewTBase
        CurrentBase = NewBase: CurrentLToe = NewLToe
        CurrentStemDB = NewStemDB: CurrentStemSP = NewStemSP
        CurrentToeDB = NewToeDB: CurrentToeSP = NewToeSP
        CurrentHeelDB = NewHeelDB: CurrentHeelSP = NewHeelSP
        
        neighbor = GetDesignFromCurrent()
        
        ' v5.1: ????????????? Check Valid (?????!)
        neighbor_cost = CalculateCostFull(neighbor, CurrentStemDB, CurrentStemSP, _
                                      CurrentToeDB, CurrentToeSP, _
                                      CurrentHeelDB, CurrentHeelSP)
        
        is_valid = CheckDesignValid(neighbor, CurrentStemDB, CurrentStemSP, _
                                    CurrentToeDB, CurrentToeSP, _
                                    CurrentHeelDB, CurrentHeelSP, _
                                    FS_OT, FS_SL, FS_BC)
        
        If iteration Mod 500 = 0 Or iteration = 1 Then
            Debug.Print "=== HCA Iteration " & iteration & " / " & MaxIterations & " ==="
        End If
        
        If is_valid Then
            If neighbor_cost < best_cost Then
                best = neighbor
                best_cost = neighbor_cost
                modDataStructures.BestCostIteration = iteration
                current = neighbor
                current_cost = neighbor_cost
                Debug.Print ">>> NEW BEST at iteration " & iteration & ": " & Format(best_cost, "#,##0") & " Baht/m"
                Call LogIteration(iteration, neighbor_cost, True, True)
            ElseIf neighbor_cost < current_cost Then
                current = neighbor
                current_cost = neighbor_cost
                Call LogIteration(iteration, neighbor_cost, True, False)
            Else
                ' Restore backup
                Currenttt = Backuptt: Currenttb = Backuptb: CurrentTBase = BackupTBase
                CurrentBase = BackupBase: CurrentLToe = BackupLToe
                CurrentStemDB = BackupStemDB: CurrentStemSP = BackupStemSP
                CurrentToeDB = BackupToeDB: CurrentToeSP = BackupToeSP
                CurrentHeelDB = BackupHeelDB: CurrentHeelSP = BackupHeelSP
                Call LogIteration(iteration, neighbor_cost, True, False)
            End If
        Else
            ' Restore backup
            Currenttt = Backuptt: Currenttb = Backuptb: CurrentTBase = BackupTBase
            CurrentBase = BackupBase: CurrentLToe = BackupLToe
            CurrentStemDB = BackupStemDB: CurrentStemSP = BackupStemSP
            CurrentToeDB = BackupToeDB: CurrentToeSP = BackupToeSP
            CurrentHeelDB = BackupHeelDB: CurrentHeelSP = BackupHeelSP
            ' v5.1: Log ???????????? (?????? 999999999)
            Call LogIteration(iteration, neighbor_cost, False, False)
        End If
        
        ' Update cost history
        If modDataStructures.BestCostIteration > 0 Then
            modDataStructures.CostHistory(iteration) = best_cost
        Else
            modDataStructures.CostHistory(iteration) = 999000
        End If
        
        DoEvents
    Next iteration
    
    ' === Complete ===
    Debug.Print "=== HCA v5.1 OPTIMIZATION COMPLETE ==="
    If modDataStructures.BestCostIteration > 0 Then
        Debug.Print "Best Cost: " & Format(best_cost, "#,##0") & " Baht/m"
        Debug.Print "Found at Iteration: " & modDataStructures.BestCostIteration
    Else
        Debug.Print "NO VALID DESIGN FOUND!"
    End If
    
    Call SaveAcceptCSV(wall_height)
    
    HillClimbingOptimization = best
End Function

'================================================================================
' SECTION 6: CSV Export Functions
'================================================================================

Public Sub InitCSVExport()
    csvAcceptData = "No.,Rejected,Passed,Passed and Better value" & vbCrLf
    bestIterationInRun = 0
End Sub

Public Sub InitLoopCounter()
    csvLoopData = "No.,Loop,BestPrice" & vbCrLf
    loopCount = 0
End Sub

'--------------------------------------------------------------------------------
' LogIteration - ????????????? iteration
' - Rejected: ??????? column 2 (Invalid)
' - Passed: ??????? column 3 (Valid ???????????? best)
' - Passed and Better value: ??????? column 4 (Valid ????????? best)
'--------------------------------------------------------------------------------
Public Sub LogIteration(iteration As Long, cost As Double, IsValid As Boolean, isBetter As Boolean)
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
' LogLoopResult - ???????? Trial
' No., Loop (iteration ????? best), BestPrice
'--------------------------------------------------------------------------------
Public Sub LogLoopResult(bestPrice As Double)
    loopCount = loopCount + 1
    csvLoopData = csvLoopData & loopCount & "," & bestIterationInRun & "," & Format(bestPrice, "0.00") & vbCrLf
End Sub

Public Sub SaveAcceptCSV(wallHeight As Double)
    Dim filePath As String, fileNum As Integer
    
    On Error GoTo ErrorHandler
    
    filePath = "D:\accept-HCA-H" & Format(wallHeight, "0") & ".csv"
    fileNum = FreeFile
    Open filePath For Output As #fileNum
    Print #fileNum, csvAcceptData;
    Close #fileNum
    Debug.Print "[CSV] Saved: " & filePath
    Exit Sub
    
ErrorHandler:
    Debug.Print "[CSV ERROR] Cannot save: " & filePath
End Sub

Public Sub SaveLoopPriceCSV(wallHeight As Double)
    Dim filePath As String, fileNum As Integer
    
    On Error GoTo ErrorHandler
    
    filePath = "D:\loopPrice-HCA-H" & Format(wallHeight, "0") & ".csv"
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
' END OF MODULE: modHillClimbing.bas v5.1
'================================================================================
