Attribute VB_Name = "modDataStructures"
Option Explicit
'================================================================================
' Module: modDataStructures.bas
' Project: RC_RT_HCA v2.8 - Cantilever Retaining Wall Optimization
' Purpose: Type definitions only (Arrays moved to modShared)
' Version: 3.0 - Refactored
'================================================================================

' === Design Type ===
Public Type Design
    ' Dimensions
    tt As Double          ' Stem top thickness (m)
    tb As Double          ' Stem bottom thickness (m)
    TBase As Double       ' Base thickness (m)
    Base As Double        ' Total base length (m)
    LToe As Double        ' Toe length (m)
    LHeel As Double       ' Heel length (m)
    
    ' Steel Design - Stem
    ASst_DB As Integer    ' Stem steel bar diameter index
    ASst_Sp As Integer    ' Stem steel spacing index
    
    ' Steel Design - Toe
    AStoe_DB As Integer   ' Toe steel bar diameter index
    AStoe_Sp As Integer   ' Toe steel spacing index
    
    ' Steel Design - Heel
    ASheel_DB As Integer  ' Heel steel bar diameter index
    ASheel_Sp As Integer  ' Heel steel spacing index
    
    ' Double Layer Flags
    UseDoubleStem As Boolean
    UseDoubleToe As Boolean
    UseDoubleHeel As Boolean
    
    ' Safety Factors
    FS_OT As Double
    FS_SL As Double
    FS_BC As Double
    
    ' Cost
    TotalCost As Double
    
    ' Validation
    IsValid As Boolean
End Type

' === Tracking Variables (ใช้ร่วมกับ modShared) ===
Public BestCostIteration As Long
Public BestTrial As Integer
Public CostHistory() As Double

' === Material Properties Type ===
Public Type MaterialProperties
    fy As Integer
    fc As Integer
    SteelGrade As String
    concretePrice As Double
    SteelPrice As Double
End Type

'================================================================================
' Get Steel Grade Name
'================================================================================
Public Function GetSteelGradeName(fy As Integer) As String
    Select Case fy
        Case 3000
            GetSteelGradeName = "SD30"
        Case 4000
            GetSteelGradeName = "SD40"
        Case Else
            GetSteelGradeName = "Unknown"
    End Select
End Function

'================================================================================
' Get Steel Price by fy
'================================================================================
Public Function GetSteelPrice(fy As Integer) As Double
    Select Case fy
        Case 3000  ' SD30
            GetSteelPrice = 28  ' Baht/kg
        Case 4000  ' SD40
            GetSteelPrice = 30  ' Baht/kg
        Case Else
            GetSteelPrice = 30  ' Default to SD40 price
    End Select
End Function

'================================================================================
' END OF MODULE
'================================================================================
