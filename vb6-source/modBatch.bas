Attribute VB_Name = "modBatch"
'================================================================================
' Module: modBatch.bas
' Project: RC_RT_HCA v2.8 - Batch Experiment Mode
' Purpose: Run experiment matrix and export 1-row-per-run CSV for paper
' Version: 0.6 (Fix MsgBox aggregation in ShowSummaryStep3_A3)
' Date: 2569 (2026)
'
' v0.6 changes from v0.5:
' - Fixed ShowSummaryStep3_A3: report TRUE optimum cost (min across 30 trials),
'   not first-trial cost. Iter@best and consist now filtered to trials that
'   achieved min cost. CSV output unchanged.
'
' v0.5 changes from v0.4:
' - Added Public Sub RunBatchStep3_A3 (Phase A3 only, 540 runs, ~10 min)
'   * 3 H x 3 fc x 2 algo x 30 trials per cell = 540 runs
'   * fc list: {240, 280, 320} (mid-high practical range)
'   * Output: D:\batch_step3_A3_{timestamp}.csv (separate file)
' - Added ShowSummaryStep3_A3 with per-cell consistency check
'   * Deterministic verification: counts unique costs per cell
'   * BA vs HCA verdict per (H, fc) cell
' - RunBatchStep3 (Phase A1+A2) unchanged from v0.4
'
' Trigger options via Form1.Command1_Click:
'     Call modBatch.RunBatchStep3       ' A1+A2 only (186 runs, ~1.5 min)
'     Call modBatch.RunBatchStep3_A3    ' A3 only (540 runs, ~10 min)
'
' DEPENDENCIES (already patched in modShared.bas + modBA.bas + modHillClimbing.bas):
'   1. Public BatchMode As Boolean   (in modShared.bas)
'   2. Guard at top of SaveAcceptCSV_BA / SaveLoopPriceCSV_BA
'   3. Guard at top of SaveAcceptCSV (HCA) / SaveLoopPriceCSV (HCA)
'================================================================================
Option Explicit

Private Const TRIALS_PER_CELL As Integer = 30

' fc options for Random mode (mirror Form1 cmdBA_Click line 591-598)
Private Const FC_OPTIONS_COUNT As Integer = 5

' Phase A3 fc list: {240, 280, 320} mid-high practical range
Private Const A3_FC_COUNT As Integer = 3

'================================================================================
' Step 3: Full Phase A matrix (186 runs)
' Phase A1: 3 H x 2 algo x 30 trials (paired random fc) = 180 runs
' Phase A2: 3 H x 2 algo x 1 trial (fc=280 fixed) = 6 runs
' Estimated time: ~3-5 minutes
'================================================================================
Public Sub RunBatchStep3()
    Dim filePath As String
    Dim startBatchTime As Double, totalBatchTime As Double
    Dim hList(1 To 3) As Double
    Dim hIdx As Integer
    Dim fcSeq() As Integer
    
    hList(1) = 3#
    hList(2) = 4#
    hList(3) = 5#
    
    filePath = "D:\batch_step3_" & Format(Now, "yyyymmdd_hhmmss") & ".csv"
    Call WriteHeader(filePath)
    
    modShared.BatchMode = True
    startBatchTime = Timer
    
    ' === Phase A1: paired random fc, 30 trials per H ===
    ' Generate fc sequence ONCE per H so BA and HCA use SAME fc per trial (paired)
    Randomize Timer
    
    For hIdx = 1 To 3
        ' Generate paired fc sequence for this H
        ReDim fcSeq(1 To TRIALS_PER_CELL)
        Call GenerateFcSequence(fcSeq)
        
        ' BA pass over the fc sequence
        Call RunCellPhaseA1(filePath, "BA", hList(hIdx), fcSeq)
        ' HCA pass using the SAME fc sequence
        Call RunCellPhaseA1(filePath, "HCA", hList(hIdx), fcSeq)
    Next hIdx
    
    ' === Phase A2: fc=280 fixed, 1 trial per cell ===
    For hIdx = 1 To 3
        Call RunCellPhaseA2(filePath, "BA", hList(hIdx), 280)
        Call RunCellPhaseA2(filePath, "HCA", hList(hIdx), 280)
    Next hIdx
    
    totalBatchTime = Timer - startBatchTime
    modShared.BatchMode = False
    
    Call ShowSummaryStep3(filePath, totalBatchTime)
End Sub

'================================================================================
' Phase A3: fc-fixed replicate matrix for paper Section 5
' 3 H x 3 fc x 2 algo x 30 trials = 540 runs, ~10 min
' fc list: {240, 280, 320} (mid-high practical range)
' Note: BA and HCA are deterministic at fixed fc -> 30 replicates verify consistency
'================================================================================
Public Sub RunBatchStep3_A3()
    Dim filePath As String
    Dim startBatchTime As Double, totalBatchTime As Double
    Dim hList(1 To 3) As Double
    Dim fcList(1 To 3) As Integer
    Dim hIdx As Integer, fcIdx As Integer
    
    hList(1) = 3#
    hList(2) = 4#
    hList(3) = 5#
    
    fcList(1) = 240
    fcList(2) = 280
    fcList(3) = 320
    
    filePath = "D:\batch_step3_A3_" & Format(Now, "yyyymmdd_hhmmss") & ".csv"
    Call WriteHeader(filePath)
    
    modShared.BatchMode = True
    startBatchTime = Timer
    
    ' === Phase A3: 3 H x 3 fc x 2 algo x 30 trials ===
    For hIdx = 1 To 3
        For fcIdx = 1 To A3_FC_COUNT
            Call RunCellPhaseA3(filePath, "BA", hList(hIdx), fcList(fcIdx))
            Call RunCellPhaseA3(filePath, "HCA", hList(hIdx), fcList(fcIdx))
        Next fcIdx
    Next hIdx
    
    totalBatchTime = Timer - startBatchTime
    modShared.BatchMode = False
    
    Call ShowSummaryStep3_A3(filePath, totalBatchTime)
End Sub

'================================================================================
' Generate sequence of TRIALS_PER_CELL random fc values from {180,210,240,280,320}
'================================================================================
Private Sub GenerateFcSequence(ByRef fcSeq() As Integer)
    Dim fcOptions(1 To 5) As Integer
    Dim i As Integer
    fcOptions(1) = 180
    fcOptions(2) = 210
    fcOptions(3) = 240
    fcOptions(4) = 280
    fcOptions(5) = 320
    
    For i = 1 To TRIALS_PER_CELL
        fcSeq(i) = fcOptions(Int(Rnd * FC_OPTIONS_COUNT) + 1)
    Next i
End Sub

'================================================================================
' Phase A1: run 30 trials with paired random fc sequence
'================================================================================
Private Sub RunCellPhaseA1(filePath As String, algoName As String, _
                            wallH As Double, fcSeq() As Integer)
    Dim trial As Integer
    For trial = 1 To TRIALS_PER_CELL
        Call RunSingleTrial(filePath, "A1", algoName, trial, _
                            wallH, 30#, 30#, fcSeq(trial))
        DoEvents
    Next trial
End Sub

'================================================================================
' Phase A2: run 1 trial with fixed fc
'================================================================================
Private Sub RunCellPhaseA2(filePath As String, algoName As String, _
                            wallH As Double, fcVal As Integer)
    Call RunSingleTrial(filePath, "A2", algoName, 1, _
                        wallH, 30#, 30#, fcVal)
    DoEvents
End Sub

'================================================================================
' Phase A3: run 30 trials with fixed fc (deterministic replicates)
'================================================================================
Private Sub RunCellPhaseA3(filePath As String, algoName As String, _
                            wallH As Double, fcVal As Integer)
    Dim trial As Integer
    For trial = 1 To TRIALS_PER_CELL
        Call RunSingleTrial(filePath, "A3", algoName, trial, _
                            wallH, 30#, 30#, fcVal)
        DoEvents
    Next trial
End Sub

'================================================================================
' RunSingleTrial: core execution unit, append 1 row to CSV
'================================================================================
Private Sub RunSingleTrial(filePath As String, phase As String, algoName As String, _
                            trial As Integer, wallH As Double, allowQa As Double, _
                            phiAng As Double, fcVal As Integer)
    Dim mat As MaterialProperties
    Dim d As Design
    Dim startTime As Double, runtime As Double
    Dim concPrice As Double
    Dim cost As Double
    Dim FS_OT As Double, FS_SL As Double, FS_BC As Double
    Dim e As Double, qMax As Double, qMin As Double
    Dim isOK As Boolean
    Dim isValid As Boolean
    Dim iterToBest As Long
    
    Dim backfillH As Double:    backfillH = 1.2
    Dim soilGamma As Double:    soilGamma = 1.8
    Dim conGamma As Double:     conGamma = 2.4
    Dim muCoef As Double:       muCoef = 0.6
    Dim conCover As Double:     conCover = 0.075
    Dim maxIter As Long:        maxIter = 5000
    
    concPrice = modShared.GetConcretePrice(fcVal)
    mat = modShared.GetSD40Material(fcVal, concPrice, modShared.STEEL_PRICE_SD40)
    
    If algoName = "BA" Then
        Call modBA.InitLoopCounter_BA
    Else
        Call modHillClimbing.InitCSVExport
    End If
    modDataStructures.BestCostIteration = 0
    
    startTime = Timer
    If algoName = "BA" Then
        d = modBA.BisectionOptimization(maxIter, wallH, backfillH, _
                                        soilGamma, conGamma, phiAng, muCoef, _
                                        allowQa, conCover, mat)
    Else
        d = modHillClimbing.HillClimbingOptimization(maxIter, wallH, backfillH, _
                                                     soilGamma, conGamma, phiAng, muCoef, _
                                                     allowQa, conCover, mat)
    End If
    runtime = Timer - startTime
    
    iterToBest = modDataStructures.BestCostIteration
    cost = modShared.CalculateCost(d)
    isOK = modShared.CheckFS_OT(d, FS_OT)
    isOK = modShared.CheckFS_SL(d, FS_SL)
    isOK = modShared.CheckFS_BC(d, FS_BC, e, qMax, qMin)
    isValid = (iterToBest > 0)
    
    Call AppendRunRow(filePath, phase, algoName, trial, wallH, allowQa, phiAng, fcVal, _
                      maxIter, d, cost, iterToBest, isValid, _
                      FS_OT, FS_SL, FS_BC, runtime)
End Sub

'================================================================================
' Step 3 summary: per-H stats for Phase A1, plus Phase A2 listing
'================================================================================
Private Sub ShowSummaryStep3(filePath As String, totalBatchTime As Double)
    Dim fileNum As Integer
    Dim line As String
    Dim parts() As String
    Dim phase As String, algo As String
    Dim h As Double, cost As Double, runtime As Double
    Dim isValid As Integer
    Dim hIdx As Integer
    
    ' Per-H, per-algo accumulators for Phase A1
    Dim a1Count(1 To 3, 1 To 2) As Integer
    Dim a1Valid(1 To 3, 1 To 2) As Integer
    Dim a1Min(1 To 3, 1 To 2) As Double
    Dim a1Max(1 To 3, 1 To 2) As Double
    Dim a1Sum(1 To 3, 1 To 2) As Double
    Dim a1Time(1 To 3, 1 To 2) As Double
    
    ' Phase A2: 3 H x 2 algo, 1 cost each
    Dim a2Cost(1 To 3, 1 To 2) As Double
    Dim a2Valid(1 To 3, 1 To 2) As Integer
    
    Dim i As Integer, j As Integer
    For i = 1 To 3
        For j = 1 To 2
            a1Min(i, j) = 1E+15
            a1Max(i, j) = 0
        Next j
    Next i
    
    fileNum = FreeFile
    Open filePath For Input As #fileNum
    Line Input #fileNum, line   ' skip header
    
    Do While Not EOF(fileNum)
        Line Input #fileNum, line
        parts = Split(line, ",")
        If UBound(parts) >= 28 Then
            phase = parts(0)
            algo = parts(2)
            h = CDbl(parts(4))
            cost = CDbl(parts(10))
            isValid = CInt(parts(12))
            runtime = CDbl(parts(28))
            
            hIdx = CInt(h) - 2   ' H=3 -> 1, H=4 -> 2, H=5 -> 3
            If hIdx < 1 Or hIdx > 3 Then GoTo NextLine
            
            Dim algoIdx As Integer
            If algo = "BA" Then
                algoIdx = 1
            ElseIf algo = "HCA" Then
                algoIdx = 2
            Else
                GoTo NextLine
            End If
            
            If phase = "A1" Then
                a1Count(hIdx, algoIdx) = a1Count(hIdx, algoIdx) + 1
                a1Time(hIdx, algoIdx) = a1Time(hIdx, algoIdx) + runtime
                If isValid = 1 Then
                    a1Valid(hIdx, algoIdx) = a1Valid(hIdx, algoIdx) + 1
                    a1Sum(hIdx, algoIdx) = a1Sum(hIdx, algoIdx) + cost
                    If cost < a1Min(hIdx, algoIdx) Then a1Min(hIdx, algoIdx) = cost
                    If cost > a1Max(hIdx, algoIdx) Then a1Max(hIdx, algoIdx) = cost
                End If
            ElseIf phase = "A2" Then
                a2Cost(hIdx, algoIdx) = cost
                a2Valid(hIdx, algoIdx) = isValid
            End If
        End If
NextLine:
    Loop
    Close #fileNum
    
    Dim msg As String
    msg = "Step 3 done!" & vbCrLf & _
          "Total: " & Format(totalBatchTime, "0.0") & " sec" & vbCrLf & _
          "CSV: " & filePath & vbCrLf & vbCrLf
    
    msg = msg & "=== Phase A1 (random fc, 30 trials) ===" & vbCrLf
    Dim hVals(1 To 3) As Integer
    hVals(1) = 3: hVals(2) = 4: hVals(3) = 5
    Dim algoLbl(1 To 2) As String
    algoLbl(1) = "BA": algoLbl(2) = "HCA"
    
    For i = 1 To 3
        For j = 1 To 2
            msg = msg & "H=" & hVals(i) & " " & algoLbl(j) & ": "
            If a1Valid(i, j) > 0 Then
                msg = msg & "valid=" & a1Valid(i, j) & "/" & a1Count(i, j) & _
                      "  mean=" & Format(a1Sum(i, j) / a1Valid(i, j), "#,##0") & _
                      "  min=" & Format(a1Min(i, j), "#,##0") & _
                      "  max=" & Format(a1Max(i, j), "#,##0") & vbCrLf
            Else
                msg = msg & "no valid run" & vbCrLf
            End If
        Next j
    Next i
    
    msg = msg & vbCrLf & "=== Phase A2 (fc=280 fixed) ===" & vbCrLf
    For i = 1 To 3
        For j = 1 To 2
            msg = msg & "H=" & hVals(i) & " " & algoLbl(j) & ": "
            If a2Valid(i, j) = 1 Then
                msg = msg & Format(a2Cost(i, j), "#,##0.00") & " Baht/m" & vbCrLf
            Else
                msg = msg & "INVALID" & vbCrLf
            End If
        Next j
    Next i
    
    MsgBox msg, vbInformation, "Batch Step 3 Summary"
End Sub

'================================================================================
' Step 3 A3 summary: per (H, fc) cell determinism check + BA vs HCA verdict
' For each cell: report unique cost values across 30 trials (should be 1)
' Then compare BA vs HCA: cost and iter_to_best
'================================================================================
Private Sub ShowSummaryStep3_A3(filePath As String, totalBatchTime As Double)
    Dim fileNum As Integer
    Dim line As String
    Dim parts() As String
    Dim phase As String, algo As String
    Dim h As Double, fcVal As Integer
    Dim cost As Double, iterBest As Long
    Dim isValid As Integer
    Dim hIdx As Integer, fcIdx As Integer, algoIdx As Integer
    Dim i As Integer, j As Integer, k As Integer, r As Integer
    
    ' Per (H, fc, algo) raw storage of all 30 trials
    ' Store cost/iter/valid for each trial; post-process after read
    Dim a3Cost(1 To 3, 1 To 3, 1 To 2, 1 To 30) As Double
    Dim a3Iter(1 To 3, 1 To 3, 1 To 2, 1 To 30) As Long
    Dim a3IsValid(1 To 3, 1 To 3, 1 To 2, 1 To 30) As Boolean
    Dim a3RowCount(1 To 3, 1 To 3, 1 To 2) As Integer  ' rows seen per cell
    Dim a3Valid(1 To 3, 1 To 3, 1 To 2) As Integer     ' valid count per cell
    
    fileNum = FreeFile
    Open filePath For Input As #fileNum
    Line Input #fileNum, line   ' skip header
    
    Do While Not EOF(fileNum)
        Line Input #fileNum, line
        parts = Split(line, ",")
        If UBound(parts) >= 28 Then
            phase = parts(0)
            If phase <> "A3" Then GoTo NextA3
            
            algo = parts(2)
            h = CDbl(parts(4))
            fcVal = CInt(parts(7))
            cost = CDbl(parts(10))
            iterBest = CLng(parts(11))
            isValid = CInt(parts(12))
            
            hIdx = CInt(h) - 2
            If hIdx < 1 Or hIdx > 3 Then GoTo NextA3
            
            Select Case fcVal
                Case 240: fcIdx = 1
                Case 280: fcIdx = 2
                Case 320: fcIdx = 3
                Case Else: GoTo NextA3
            End Select
            
            If algo = "BA" Then
                algoIdx = 1
            ElseIf algo = "HCA" Then
                algoIdx = 2
            Else
                GoTo NextA3
            End If
            
            ' Append this trial to the cell's raw array
            a3RowCount(hIdx, fcIdx, algoIdx) = a3RowCount(hIdx, fcIdx, algoIdx) + 1
            r = a3RowCount(hIdx, fcIdx, algoIdx)
            If r <= 30 Then
                a3Cost(hIdx, fcIdx, algoIdx, r) = cost
                a3Iter(hIdx, fcIdx, algoIdx, r) = iterBest
                a3IsValid(hIdx, fcIdx, algoIdx, r) = (isValid = 1)
                If isValid = 1 Then a3Valid(hIdx, fcIdx, algoIdx) = a3Valid(hIdx, fcIdx, algoIdx) + 1
            End If
        End If
NextA3:
    Loop
    Close #fileNum
    
    Dim msg As String
    msg = "Phase A3 done!" & vbCrLf & _
          "Total: " & Format(totalBatchTime, "0.0") & " sec" & vbCrLf & _
          "CSV: " & filePath & vbCrLf & vbCrLf & _
          "=== Phase A3 (fc fixed, 30 trials per cell) ===" & vbCrLf & _
          "Format: H/fc -- BA cost(consist/valid,iter) vs HCA cost(consist/valid,iter)" & vbCrLf & vbCrLf
    
    Dim hVals(1 To 3) As Integer
    hVals(1) = 3: hVals(2) = 4: hVals(3) = 5
    Dim fcVals(1 To 3) As Integer
    fcVals(1) = 240: fcVals(2) = 280: fcVals(3) = 320
    
    Dim baCost As Double, hcaCost As Double
    Dim baIter As Long, hcaIter As Long
    Dim baConsist As Integer, hcaConsist As Integer
    Dim verdict As String
    
    ' Local scratch vars for 2-pass per-cell post-processing
    Dim minCost As Double, minIterAtBest As Long, consistCount As Integer
    Dim n As Integer
    
    For i = 1 To 3   ' H
        For j = 1 To 3   ' fc
            ' --- BA aggregation ---
            n = a3RowCount(i, j, 1)
            minCost = 1E+15
            For r = 1 To n
                If a3IsValid(i, j, 1, r) Then
                    If a3Cost(i, j, 1, r) < minCost Then minCost = a3Cost(i, j, 1, r)
                End If
            Next r
            consistCount = 0
            minIterAtBest = 999999999
            For r = 1 To n
                If a3IsValid(i, j, 1, r) Then
                    If Abs(a3Cost(i, j, 1, r) - minCost) < 0.01 Then
                        consistCount = consistCount + 1
                        If a3Iter(i, j, 1, r) < minIterAtBest Then minIterAtBest = a3Iter(i, j, 1, r)
                    End If
                End If
            Next r
            If consistCount = 0 Then
                baCost = 0
                baIter = 0
                baConsist = 0
            Else
                baCost = minCost
                baIter = minIterAtBest
                baConsist = consistCount
            End If
            
            ' --- HCA aggregation ---
            n = a3RowCount(i, j, 2)
            minCost = 1E+15
            For r = 1 To n
                If a3IsValid(i, j, 2, r) Then
                    If a3Cost(i, j, 2, r) < minCost Then minCost = a3Cost(i, j, 2, r)
                End If
            Next r
            consistCount = 0
            minIterAtBest = 999999999
            For r = 1 To n
                If a3IsValid(i, j, 2, r) Then
                    If Abs(a3Cost(i, j, 2, r) - minCost) < 0.01 Then
                        consistCount = consistCount + 1
                        If a3Iter(i, j, 2, r) < minIterAtBest Then minIterAtBest = a3Iter(i, j, 2, r)
                    End If
                End If
            Next r
            If consistCount = 0 Then
                hcaCost = 0
                hcaIter = 0
                hcaConsist = 0
            Else
                hcaCost = minCost
                hcaIter = minIterAtBest
                hcaConsist = consistCount
            End If
            
            ' --- Verdict (paper claim: BA cost <= HCA AND BA iter <= HCA) ---
            If baConsist = 0 Or hcaConsist = 0 Then
                verdict = "no valid"
            ElseIf Abs(baCost - hcaCost) < 0.01 And baIter <= hcaIter Then
                verdict = "tie cost, BA iter lower"
            ElseIf Abs(baCost - hcaCost) < 0.01 And baIter > hcaIter Then
                verdict = "tie cost, HCA iter lower"
            ElseIf baCost < hcaCost - 0.01 Then
                verdict = "BA cost lower"
            ElseIf baCost > hcaCost + 0.01 Then
                verdict = "HCA cost lower"
            Else
                verdict = "tie"
            End If
            
            msg = msg & "H=" & hVals(i) & " fc=" & fcVals(j) & ":  " & _
                  "BA " & Format(baCost, "#,##0") & "(" & baConsist & "/" & a3Valid(i, j, 1) & "," & baIter & "it)  " & _
                  "HCA " & Format(hcaCost, "#,##0") & "(" & hcaConsist & "/" & a3Valid(i, j, 2) & "," & hcaIter & "it)  " & _
                  "[" & verdict & "]" & vbCrLf
        Next j
    Next i
    
    MsgBox msg, vbInformation, "Batch Step 3 A3 Summary"
End Sub

'================================================================================
' CSV header (added 'phase' as first column)
'================================================================================
Private Sub WriteHeader(filePath As String)
    Dim fileNum As Integer
    Dim header As String
    
    header = "phase,run_id,algorithm,trial,H,qa,phi,fc,fy,max_iter," & _
             "total_cost,iter_to_best,is_valid," & _
             "fs_ot,fs_sl,fs_bc," & _
             "tt,tb,tbase,base_w,ltoe,lheel," & _
             "stem_db_mm,stem_sp_m,toe_db_mm,toe_sp_m,heel_db_mm,heel_sp_m," & _
             "runtime_sec,timestamp"
    
    fileNum = FreeFile
    Open filePath For Output As #fileNum
    Print #fileNum, header
    Close #fileNum
End Sub

'================================================================================
' Append 1 row per run (with phase column)
'================================================================================
Private Sub AppendRunRow(filePath As String, phase As String, algoName As String, _
                          trial As Integer, wallH As Double, allowQa As Double, _
                          phiAng As Double, fcVal As Integer, _
                          maxIter As Long, d As Design, _
                          cost As Double, iterToBest As Long, isValid As Boolean, _
                          FS_OT As Double, FS_SL As Double, FS_BC As Double, _
                          runtime As Double)
    Dim fileNum As Integer
    Dim row As String
    Dim runId As String
    Dim stemDB As Integer, stemSP As Double
    Dim toeDB As Integer, toeSP As Double
    Dim heelDB As Integer, heelSP As Double
    
    stemDB = ResolveDBValue(d.ASst_DB)
    stemSP = ResolveSPValue(d.ASst_Sp)
    toeDB = ResolveDBValue(d.AStoe_DB)
    toeSP = ResolveSPValue(d.AStoe_Sp)
    heelDB = ResolveDBValue(d.ASheel_DB)
    heelSP = ResolveSPValue(d.ASheel_Sp)
    
    runId = phase & "_" & algoName & "_H" & Format(wallH, "0") & _
            "_fc" & fcVal & "_t" & Format(trial, "00")
    
    row = phase & "," & runId & "," & algoName & "," & trial & "," & _
          Format(wallH, "0.0") & "," & Format(allowQa, "0.0") & "," & _
          Format(phiAng, "0.0") & "," & fcVal & "," & 4000 & "," & maxIter & "," & _
          Format(cost, "0.00") & "," & iterToBest & "," & _
          IIf(isValid, "1", "0") & "," & _
          Format(FS_OT, "0.000") & "," & Format(FS_SL, "0.000") & "," & _
          Format(FS_BC, "0.000") & "," & _
          Format(d.tt, "0.000") & "," & Format(d.tb, "0.000") & "," & _
          Format(d.TBase, "0.000") & "," & Format(d.Base, "0.000") & "," & _
          Format(d.LToe, "0.000") & "," & Format(d.LHeel, "0.000") & "," & _
          stemDB & "," & Format(stemSP, "0.00") & "," & _
          toeDB & "," & Format(toeSP, "0.00") & "," & _
          heelDB & "," & Format(heelSP, "0.00") & "," & _
          Format(runtime, "0.00") & "," & _
          Format(Now, "yyyy-mm-dd hh:nn:ss")
    
    fileNum = FreeFile
    Open filePath For Append As #fileNum
    Print #fileNum, row
    Close #fileNum
End Sub

Private Function ResolveDBValue(dbIdx As Integer) As Integer
    If dbIdx >= modShared.DB_MIN And dbIdx <= modShared.DB_MAX Then
        ResolveDBValue = modShared.WP_DB(dbIdx)
    ElseIf dbIdx >= 1 And dbIdx <= 5 Then
        ResolveDBValue = modShared.DBArray(dbIdx)
    Else
        ResolveDBValue = 0
    End If
End Function

Private Function ResolveSPValue(spIdx As Integer) As Double
    If spIdx >= modShared.SP_MIN And spIdx <= modShared.SP_MAX Then
        ResolveSPValue = modShared.WP_SP(spIdx)
    ElseIf spIdx >= 1 And spIdx <= 4 Then
        ResolveSPValue = modShared.SPArray(spIdx)
    Else
        ResolveSPValue = 0
    End If
End Function

'================================================================================
' END OF MODULE: modBatch.bas v0.5 - Step 3 Phase A1+A2+A3 complete
'================================================================================
